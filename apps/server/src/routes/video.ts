// =========================================================================
// Video API Routes -- Phase 4: Image-to-video
// =========================================================================

import { FastifyInstance } from "fastify";
import { createReadStream, existsSync, statSync } from "node:fs";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { videoClips, scenes, projects } from "../db/schema.js";
import { hasApiKey } from "../services/api/RunningHubVideoClient.js";
import { buildClipDiagnosticsDto, toVideoClipDto } from "../services/video/ClipDiagnosticsDto.js";
import { createJob } from "../services/jobs/JobService.js";
import { startVideoWorker } from "../services/jobs/VideoWorker.js";
import { startVideoRetryWorker } from "../services/jobs/VideoRetryWorker.js";

export async function videoRoutes(app: FastifyInstance) {
  // ---- 0. Check API key status ---------------------------------------------

  app.get("/projects/:projectId/videos/check-key", async () => ({
    success: true,
    data: { configured: hasApiKey() },
  }));

  // ---- 1. Generate video (submit to RunningHub) -----------------------------------
  // POST /api/projects/:projectId/videos/generate

  app.post<{ Params: { projectId: string } }>(
    "/projects/:projectId/videos/generate",
    async (request, reply) => {
      if (!hasApiKey()) {
        return reply.status(400).send({
          success: false,
          error: "RUNNINGHUB_API_KEY not configured. Please set it in .env",
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

      // 校验：只有故事板审核通过的 scene 才能生成视频
      if (body.sceneIds && body.sceneIds.length > 0) {
        for (const sid of body.sceneIds) {
          const sc = db.select().from(scenes).where(eq(scenes.id, sid)).get();
          if (!sc || sc.projectId !== request.params.projectId) {
            return reply.status(404).send({ success: false, error: `Scene ${sid} not found` });
          }
          if (sc.storyboardReviewStatus !== "approved") {
            return reply.status(400).send({
              success: false,
              error: `故事板未审核通过，不能生成视频（Scene: ${sc.title || sc.order}）`,
            });
          }
        }
      } else {
        // 不传 sceneIds 时检查全部
        const allProjectScenes = db.select().from(scenes).where(eq(scenes.projectId, request.params.projectId)).all();
        const unapproved = allProjectScenes.filter((s) => s.storyboardReviewStatus !== "approved");
        if (unapproved.length > 0) {
          return reply.status(400).send({
            success: false,
            error: `有 ${unapproved.length} 个镜头故事板未审核通过，不能生成视频`,
          });
        }
      }

      // Create background video task, return immediately jobId
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

  // ---- 2. Get all video clips for project (with isCurrent flag)-------------------------
  // GET /api/projects/:projectId/videos

  app.get<{ Params: { projectId: string } }>(
    "/projects/:projectId/videos",
    async (request) => {
      // Load all scenes' current_clip_id
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
        data: annotateClipsWithRetryLineage(rows, currentClipMap),
      };
    },
  );

  // ---- 3. Get video clips for a single scene (with isCurrent flag)-------------------------
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

      var currentClipMapForScene = scene?.currentClipId ? { [request.params.sceneId]: scene.currentClipId } : {};

      return {
        success: true,
        data: annotateClipsWithRetryLineage(rows, currentClipMapForScene),
      };
    },
  );

  // ---- 4. Poll all running clips (manual trigger)--------------------------------
  // POST /api/projects/:projectId/videos/poll

  app.post<{ Params: { projectId: string } }>(
    "/projects/:projectId/videos/poll",
    async () => {
      // Poller runs automatically; this endpoint provides manual trigger
      return { success: true, data: { message: "Background polling is already running" } };
      },
  );

  // ---- 5. POST /use-version -- Persist current version selection --------------------------

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


  // ---- 6. POST /retry -- Safe retry for failed clips ---------------------------------
  // POST /api/projects/:projectId/scenes/:sceneId/videos/:clipId/retry

  app.post<{ Params: { projectId: string; sceneId: string; clipId: string } }>(
    "/projects/:projectId/scenes/:sceneId/videos/:clipId/retry",
    async (request, reply) => {
      if (!hasApiKey()) {
        return reply.status(400).send({
          success: false,
          error: "RUNNINGHUB_API_KEY not configured. Please set it in .env",
        });
      }

      const clip = db
        .select()
        .from(videoClips)
        .where(eq(videoClips.id, request.params.clipId))
        .get();

      if (!clip) {
        return reply.status(404).send({ success: false, error: "Clip not found" });
      }

      if (clip.projectId !== request.params.projectId || clip.sceneId !== request.params.sceneId) {
        return reply.status(400).send({
          success: false,
          error: "Clip does not belong to this scene/project",
        });
      }

      if (clip.status !== "failed") {
        return reply.status(400).send({
          success: false,
          error: "Only failed clips can be retried",
        });
      }

      const body = (request.body ?? {}) as { retryReason?: string };

      const job = createJob(request.params.projectId, "VIDEO_RETRY", {
        sceneId: request.params.sceneId,
        sourceClipId: request.params.clipId,
        retryReason: body.retryReason ?? clip.error ?? "Retry failed clip",
      });

      startVideoRetryWorker(job.id, {
        projectId: request.params.projectId,
        sceneId: request.params.sceneId,
        clipId: request.params.clipId,
        retryReason: body.retryReason ?? clip.error ?? undefined,
      });

      return {
        success: true,
        data: {
          jobId: job.id,
          status: job.status,
          sourceClipId: clip.id,
          retryClipId: null,
          sceneId: clip.sceneId,
          projectId: clip.projectId,
        },
      };
    },
  );

  // ---- 7. Single clip diagnostics detail endpoint ---------------------------
  // GET /api/projects/:projectId/scenes/:sceneId/videos/:clipId/diagnostics
  // GET /api/projects/:projectId/scenes/:sceneId/videos/:clipId/diagnostics

  app.get<{ Params: { projectId: string; sceneId: string; clipId: string } }>(
    "/projects/:projectId/scenes/:sceneId/videos/:clipId/diagnostics",
    async (request, reply) => {
      const clip = db
        .select()
        .from(videoClips)
        .where(eq(videoClips.id, request.params.clipId))
        .get();

      if (!clip) {
        return reply.status(404).send({ success: false, error: "Clip not found" });
      }

      if (clip.projectId !== request.params.projectId || clip.sceneId !== request.params.sceneId) {
        return reply.status(400).send({
          success: false,
          error: "Clip does not belong to this scene/project",
        });
      }

      return {
        success: true,
        data: {
          clipId: clip.id,
          projectId: clip.projectId,
          sceneId: clip.sceneId,
          version: clip.version,
          status: clip.status,
          taskId: clip.taskId,
          diagnostics: buildClipDiagnosticsDto(clip, { includeFull: true }),
        },
      };
    },
  );

  // ---- 8. Serve video file download -----------------------------------------------
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


// ---- Helper: batch retry lineage ------------------------------------------

function annotateClipsWithRetryLineage(rows: any[], currentClipMap: Record<string, string>) {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const childrenBySource = new Map<string, any[]>();

  for (const row of rows) {
    if (row.retryOfClipId) {
      const list = childrenBySource.get(row.retryOfClipId) ?? [];
      list.push(row);
      childrenBySource.set(row.retryOfClipId, list);
    }
  }

  return rows.map((row) => {
    const dto = annotateClip(row, currentClipMap[row.sceneId]);
    const source = row.retryOfClipId ? byId.get(row.retryOfClipId) : null;
    const children = childrenBySource.get(row.id) ?? [];

    return {
      ...dto,
      retrySource: source
        ? {
            id: source.id,
            version: source.version,
            status: source.status,
            error: source.error ?? null,
          }
        : null,
      retryChildren: children.map((child) => ({
        id: child.id,
        version: child.version,
        status: child.status,
        createdAt: child.createdAt,
      })),
    };
  });
}

// ---- Helper ----------------------------------------------------------------

function annotateClip(row: any, currentClipIdForScene?: string) {
  return toVideoClipDto(row, currentClipIdForScene, {
    includeFullDiagnostics: false,
  });
}
