// =========================================================================
// Video API Routes — Phase 4: 图生视频
// =========================================================================

import { FastifyInstance } from "fastify";
import { createReadStream, existsSync, statSync } from "node:fs";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { videoClips, scenes, projects } from "../db/schema.js";
import { hasApiKey } from "../services/api/RunningHubVideoClient.js";
import { createJob } from "../services/jobs/JobService.js";
import { startVideoWorker } from "../services/jobs/VideoWorker.js";

export async function videoRoutes(app: FastifyInstance) {
  // ---- 0. 检查 API Key 状态 ---------------------------------------------

  app.get("/projects/:projectId/videos/check-key", async () => ({
    success: true,
    data: { configured: hasApiKey() },
  }));

  // ---- 1. 生成视频（提交到 RunningHub） -----------------------------------
  // POST /api/projects/:projectId/videos/generate

  app.post<{ Params: { projectId: string } }>(
    "/projects/:projectId/videos/generate",
    async (request, reply) => {
      if (!hasApiKey()) {
        return reply.status(400).send({
          success: false,
          error: "RUNNINGHUB_API_KEY 未配置，请在 .env 中设置",
        });
      }

      const project = db
        .select()
        .from(projects)
        .where(eq(projects.id, request.params.projectId))
        .get();

      if (!project) {
        return reply.status(404).send({ success: false, error: "Project not found" });
      }

      const body = (request.body ?? {}) as { sceneIds?: string[] };

      // 创建后台视频任务，立即返回 jobId
      const job = createJob(request.params.projectId, "VIDEO_GENERATE", {
        sceneIds: body.sceneIds ?? undefined,
      });
      startVideoWorker(job.id, request.params.projectId, body.sceneIds);

      return {
        success: true,
        data: { jobId: job.id, status: job.status },
      };
    },
  );

  // ---- 2. 获取项目的所有视频 clip（含 isCurrent 标记）-------------------------
  // GET /api/projects/:projectId/videos

  app.get<{ Params: { projectId: string } }>(
    "/projects/:projectId/videos",
    async (request) => {
      // 加载所有 scene 的 current_clip_id
      const sceneRows = db
        .select()
        .from(scenes)
        .where(eq(scenes.projectId, request.params.projectId))
        .all();
      const currentClipMap: Record<string, string> = {};
      for (const s of sceneRows) {
        if (s.currentClipId) currentClipMap[s.id] = s.currentClipId;
      }

      const rows = db
        .select()
        .from(videoClips)
        .where(eq(videoClips.projectId, request.params.projectId))
        .orderBy(videoClips.order)
        .all();

      return {
        success: true,
        data: rows.map((r) => annotateClip(r, currentClipMap[r.sceneId])),
      };
    },
  );

  // ---- 3. 获取单个场景的视频 clip（含 isCurrent 标记）-------------------------
  // GET /api/projects/:projectId/scenes/:sceneId/videos

  app.get<{ Params: { projectId: string; sceneId: string } }>(
    "/projects/:projectId/scenes/:sceneId/videos",
    async (request) => {
      const scene = db
        .select()
        .from(scenes)
        .where(eq(scenes.id, request.params.sceneId))
        .get();

      const rows = db
        .select()
        .from(videoClips)
        .where(
          eq(videoClips.sceneId, request.params.sceneId),
        )
        .orderBy(videoClips.version)
        .all();

      return {
        success: true,
        data: rows.map((r) => annotateClip(r, scene?.currentClipId ?? undefined)),
      };
    },
  );

  // ---- 4. 轮询所有正在运行的 clip（手动触发）--------------------------------
  // POST /api/projects/:projectId/videos/poll

  app.post<{ Params: { projectId: string } }>(
    "/projects/:projectId/videos/poll",
    async () => {
      // 后台轮询器会自动运行，这个端点提供手动触发
      return { success: true, data: { message: "后台轮询已在运行中" } };
      },
  );

  // ---- 5. POST /use-version — 持久化当前版本选择 --------------------------

  app.post<{ Params: { projectId: string; sceneId: string; clipId: string } }>(
    "/projects/:projectId/scenes/:sceneId/videos/:clipId/use-version",
    async (request, reply) => {
      const clip = db
        .select()
        .from(videoClips)
        .where(eq(videoClips.id, request.params.clipId))
        .get();

      if (!clip) {
        return reply.status(404).send({ success: false, error: "Clip not found" });
      }
      if (clip.sceneId !== request.params.sceneId || clip.projectId !== request.params.projectId) {
        return reply.status(400).send({ success: false, error: "Clip does not belong to this scene/project" });
      }
      if (clip.status !== "ready") {
        return reply.status(400).send({
          success: false,
          error: "Only ready clips can be used as current version",
        });
      }

      db.update(scenes)
        .set({ currentClipId: clip.id, updatedAt: new Date().toISOString() })
        .where(eq(scenes.id, request.params.sceneId))
        .run();

      return { success: true, data: { sceneId: request.params.sceneId, clipId: clip.id, version: clip.version } };
    },
  );

  // ---- 6. 提供视频文件下载 -----------------------------------------------
  // GET /api/projects/:projectId/scenes/:sceneId/videos/:clipId/video

  app.get<{ Params: { projectId: string; sceneId: string; clipId: string } }>(
    "/projects/:projectId/scenes/:sceneId/videos/:clipId/video",
    async (request, reply) => {
      const clip = db
        .select()
        .from(videoClips)
        .where(eq(videoClips.id, request.params.clipId))
        .get();

      if (!clip || !clip.localPath) {
        return reply.status(404).send({ success: false, error: "Clip not found" });
      }

      if (!existsSync(clip.localPath)) {
        return reply.status(404).send({ success: false, error: "Video file not found on disk" });
      }
      const stat = statSync(clip.localPath);
      const fileSize = stat.size;
      const range = request.headers.range;

      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = end - start + 1;
        const stream = createReadStream(clip.localPath, { start, end });
        reply
          .status(206)
          .header("Content-Range", `bytes ${start}-${end}/${fileSize}`)
          .header("Accept-Ranges", "bytes")
          .header("Content-Length", chunkSize)
          .type("video/mp4");
        return reply.send(stream);
      } else {
        reply
          .header("Content-Length", fileSize)
          .header("Accept-Ranges", "bytes")
          .type("video/mp4");
        return reply.send(createReadStream(clip.localPath));
      }
    },
  );
}

// ---- 辅助 ----------------------------------------------------------------

function annotateClip(row: any, currentClipIdForScene?: string) {
  return {
    ...row,
    locked: row.locked !== undefined ? !!row.locked : undefined,
    isCurrent: currentClipIdForScene === row.id,
  };
}
