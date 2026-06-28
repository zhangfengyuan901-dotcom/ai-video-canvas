// =========================================================================
// Storyboard API Routes 鈥?Phase 2: 涓夊鏍兼晠浜嬫澘
// =========================================================================

import { FastifyInstance } from "fastify";
      import { v4 as uuid } from "uuid";
      import { eq } from "drizzle-orm";
          import { db } from "../db/index.js";
          import { projects, scenes, storyboardPanels } from "../db/schema.js";
          import { generatePanelPrompts } from "../services/llm/PanelPromptService.js";
          import { generateAndDownload } from "../services/api/PackyImageClient.js";
          import { getPanelPath, getStripPath, getUploadedPanelPath } from "../services/storage/AssetStorageService.js";
          import type { UploadImageExt } from "../services/storage/AssetStorageService.js";
          import { pipeline } from "node:stream/promises";
          import { createWriteStream } from "node:fs";
          import { existsSync, readFileSync } from "node:fs";
          import { generateStoryboardSchema } from "@ai-video-canvas/shared";
          import type { StyleBible, PanelRole, PanelStatus, StoryboardPanel } from "@ai-video-canvas/shared";
          import { composeStoryboardStrip } from "../services/storage/StripService.js";
import { createJob } from "../services/jobs/JobService.js";
import { startStoryboardWorker } from "../services/jobs/StoryboardWorker.js";

// ---- 辅助：MIME 到扩展名映射 ---------------------------------------------

function extFromMime(mimeType: string): UploadImageExt | null {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  return null;
}

export async function storyboardRoutes(app: FastifyInstance) {
  // ---- 1. Generate storyboard panels for scenes (async job) ------------
  // POST /projects/:projectId/storyboard/generate

  app.post<{ Params: { projectId: string } }>(
    "/projects/:projectId/storyboard/generate",
    async (request, reply) => {
      const parsed = generateStoryboardSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: parsed.error.issues.map((i) => i.message).join(", "),
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

      // 鍒涘缓鍚庡彴 storyboard 浠诲姟锛岀珛鍗宠繑鍥?jobId
      const job = createJob(request.params.projectId, "STORYBOARD_GENERATE", {
        sceneIds: parsed.data.sceneIds,
      });
      startStoryboardWorker(job.id, request.params.projectId, parsed.data.sceneIds);

      return {
        success: true,
        data: { jobId: job.id, status: job.status },
      };
    },
  );

  // ---- 2. Get panels for a scene ---------------------------------------
  // GET /projects/:projectId/scenes/:sceneId/panels

  app.get<{ Params: { projectId: string; sceneId: string } }>(
    "/projects/:projectId/scenes/:sceneId/panels",
    async (request, reply) => {
      const scene = db
        .select()
        .from(scenes)
        .where(eq(scenes.id, request.params.sceneId))
        .get();

      if (!scene || scene.projectId !== request.params.projectId) {
        return reply.status(404).send({
          success: false,
          error: "Scene not found for this project",
        });
      }

      const rows = db
        .select()
        .from(storyboardPanels)
        .where(eq(storyboardPanels.sceneId, request.params.sceneId))
        .orderBy(storyboardPanels.panelIndex)
        .all();

      return {
        success: true,
        data: rows.map((r) => ({ ...r, locked: !!r.locked })),
      };
    },
  );

  // ---- 3. Regenerate a single panel ------------------------------------
  // POST /projects/:projectId/scenes/:sceneId/panels/:panelIndex/regenerate

  app.post<{ Params: { projectId: string; sceneId: string; panelIndex: string } }>(
    "/projects/:projectId/scenes/:sceneId/panels/:panelIndex/regenerate",
    async (request, reply) => {
      const panelIndex = parseInt(request.params.panelIndex, 10);
      if (isNaN(panelIndex) || panelIndex < 0 || panelIndex > 2) {
        return reply.status(400).send({ success: false, error: "panelIndex must be 0, 1, or 2" });
      }

      // 鏌ヨ椤圭洰
      const project = db
        .select()
        .from(projects)
        .where(eq(projects.id, request.params.projectId))
        .get();

      if (!project) {
        return reply.status(404).send({ success: false, error: "Project not found" });
      }

      // 鏌ヨ宸叉湁 panel 璁板綍
      const existing = db
        .select()
        .from(storyboardPanels)
        .where(eq(storyboardPanels.sceneId, request.params.sceneId))
        .all()
        .find((p) => p.panelIndex === panelIndex);

      if (!existing) {
        return reply.status(404).send({ success: false, error: "Panel not found for this scene" });
      }

      const aspectRatio = project.aspectRatio as "16:9" | "9:16";
      const version = existing.version + 1;
      const localPath = getPanelPath(project.id, request.params.sceneId, panelIndex, version);

      db.update(storyboardPanels)
        .set({ version, localPath, status: "generating", updatedAt: new Date().toISOString() })
        .where(eq(storyboardPanels.id, existing.id))
        .run();

      try {
        const result = await generateAndDownload(existing.prompt, localPath, aspectRatio);

        db.update(storyboardPanels)
          .set({
            status: "ready",
            revisedPrompt: result.revisedPrompt ?? null,
            remoteUrl: result.remoteUrl,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(storyboardPanels.id, existing.id))
          .run();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Regeneration failed";

        db.update(storyboardPanels)
          .set({ status: "failed", error: msg, updatedAt: new Date().toISOString() })
          .where(eq(storyboardPanels.id, existing.id))
          .run();

        return reply.status(500).send({ success: false, error: msg });
      }

      const updated = db.select().from(storyboardPanels).where(eq(storyboardPanels.id, existing.id)).get();
      return { success: true, data: updated ? { ...updated, locked: !!updated.locked } : null };
    },
  );
  // ---- 4. Serve panel image -------------------------------------------
  // GET /api/projects/:projectId/scenes/:sceneId/panels/:panelIndex/image

  app.get<{ Params: { projectId: string; sceneId: string; panelIndex: string } }>(
    "/projects/:projectId/scenes/:sceneId/panels/:panelIndex/image",
    async (request, reply) => {
      const panelIndex = parseInt(request.params.panelIndex, 10);
      if (isNaN(panelIndex) || panelIndex < 0 || panelIndex > 2) {
        return reply.status(400).send({ success: false, error: "panelIndex must be 0, 1, or 2" });
      }

      const panel = db
        .select()
        .from(storyboardPanels)
        .where(eq(storyboardPanels.sceneId, request.params.sceneId))
        .all()
        .find((p) => p.panelIndex === panelIndex);

      if (!panel) {
        return reply.status(404).send({ success: false, error: "Panel not found" });
      }
      if (panel.projectId !== request.params.projectId) {
        return reply.status(404).send({ success: false, error: "Panel not found for this project" });
      }
      if (!panel.localPath || !existsSync(panel.localPath)) {
        return reply.status(404).send({ success: false, error: "Image not found on disk" });
      }

      return reply.type(panel.mimeType ?? "image/png").send(readFileSync(panel.localPath));
    },
  );
  // ---- 5. Upload panel image ---------------------------------------------
  // POST /api/projects/:projectId/scenes/:sceneId/panels/:panelIndex/upload

  app.post<{ Params: { projectId: string; sceneId: string; panelIndex: string } }>(
    "/projects/:projectId/scenes/:sceneId/panels/:panelIndex/upload",
    async (request, reply) => {
      const panelIndex = parseInt(request.params.panelIndex, 10);
      if (isNaN(panelIndex) || panelIndex < 0 || panelIndex > 2) {
        return reply.status(400).send({ success: false, error: "panelIndex must be 0, 1, or 2" });
      }

      const projectId = request.params.projectId;
      const sceneId = request.params.sceneId;

      // 校验 scene 归属
      const scene = db.select().from(scenes).where(eq(scenes.id, sceneId)).get();
      if (!scene || scene.projectId !== projectId) {
        return reply.status(404).send({ success: false, error: "Scene not found for this project" });
      }

      // 读取上传文件
      const data = await request.file();
      if (!data) {
        return reply.status(400).send({ success: false, error: "File is required" });
      }

      const ext = extFromMime(data.mimetype);
      if (!ext) {
        return reply.status(400).send({ success: false, error: "Only PNG, JPEG, and WebP images are supported" });
      }

      // 查询现有 panel
      const existing = db
        .select()
        .from(storyboardPanels)
        .where(eq(storyboardPanels.sceneId, sceneId))
        .all()
        .find((p) => p.panelIndex === panelIndex);

      const version = existing ? existing.version + 1 : 1;
      const panelId = existing ? existing.id : uuid();
      const roleMap: Record<number, string> = { 0: "start", 1: "middle", 2: "end" };
      const role = roleMap[panelIndex];
      const prompt = existing ? existing.prompt : "用户上传素材";

      // 写入文件
      const localPath = getUploadedPanelPath(projectId, sceneId, panelIndex, version, ext);
      await pipeline(data.file, createWriteStream(localPath));

      const now = new Date().toISOString();

      if (existing) {
        db.update(storyboardPanels)
          .set({
            version,
            localPath,
            remoteUrl: null,
            revisedPrompt: null,
            status: "ready",
            sourceType: "upload",
            originalFilename: data.filename ?? null,
            mimeType: data.mimetype,
            error: null,
            updatedAt: now,
          })
          .where(eq(storyboardPanels.id, existing.id))
          .run();
      } else {
        db.insert(storyboardPanels)
          .values({
            id: panelId,
            projectId,
            sceneId,
            panelIndex,
            role,
            prompt,
            revisedPrompt: null,
            remoteUrl: null,
            localPath,
            status: "ready",
            locked: 0,
            version,
            sourceType: "upload",
            originalFilename: data.filename ?? null,
            mimeType: data.mimetype,
            error: null,
            createdAt: now,
            updatedAt: now,
          })
          .run();
      }

      // 重新检查三张 panel 是否都 ready
      const allPanels = db
        .select()
        .from(storyboardPanels)
        .where(eq(storyboardPanels.sceneId, sceneId))
        .all()
        .filter((p) => p.status === "ready" && p.localPath && existsSync(p.localPath));
      if (allPanels.length === 3) {
        db.update(scenes)
          .set({ status: "storyboard_ready", updatedAt: now })
          .where(eq(scenes.id, sceneId))
          .run();
      }

      const updated = db.select().from(storyboardPanels).where(eq(storyboardPanels.id, panelId)).get();
      return { success: true, data: updated ? { ...updated, locked: !!updated.locked } : null };
    },
  );

  // ---- 6. Clear panel image -----------------------------------------------
  // DELETE /api/projects/:projectId/scenes/:sceneId/panels/:panelIndex

  app.delete<{ Params: { projectId: string; sceneId: string; panelIndex: string } }>(
    "/projects/:projectId/scenes/:sceneId/panels/:panelIndex",
    async (request, reply) => {
      const panelIndex = parseInt(request.params.panelIndex, 10);
      if (isNaN(panelIndex) || panelIndex < 0 || panelIndex > 2) {
        return reply.status(400).send({ success: false, error: "panelIndex must be 0, 1, or 2" });
      }

      const projectId = request.params.projectId;
      const sceneId = request.params.sceneId;

      // 校验 scene 归属
      const scene = db.select().from(scenes).where(eq(scenes.id, sceneId)).get();
      if (!scene || scene.projectId !== projectId) {
        return reply.status(404).send({ success: false, error: "Scene not found for this project" });
      }

      const panel = db
        .select()
        .from(storyboardPanels)
        .where(eq(storyboardPanels.sceneId, sceneId))
        .all()
        .find((p) => p.panelIndex === panelIndex);

      if (!panel) {
        return reply.status(404).send({ success: false, error: "Panel not found" });
      }
      if (panel.projectId !== projectId || panel.sceneId !== sceneId) {
        return reply.status(404).send({ success: false, error: "Panel not found for this project" });
      }

      const now = new Date().toISOString();

      // 软清空：不删除文件，只重置状态
      db.update(storyboardPanels)
        .set({
          status: "queued",
          localPath: null,
          remoteUrl: null,
          revisedPrompt: null,
          error: null,
          sourceType: "ai",
          originalFilename: null,
          mimeType: null,
          updatedAt: now,
        })
        .where(eq(storyboardPanels.id, panel.id))
        .run();

      // 如果 scene 状态是 storyboard_ready，降级为 draft
      if (scene.status === "storyboard_ready") {
        db.update(scenes)
          .set({ status: "draft", updatedAt: now })
          .where(eq(scenes.id, sceneId))
          .run();
      }

      return { success: true, data: { sceneId, panelIndex, status: "queued" } };
    },
  );

  // ---- 7. Serve scene preview image --------------------------------------
  // GET /api/projects/:projectId/scenes/:sceneId/preview
  // Fallback chain: strip → panel0 → any ready panel → 404

  app.get<{ Params: { projectId: string; sceneId: string } }>(
    "/projects/:projectId/scenes/:sceneId/preview",
    async (request, reply) => {
      const scene = db
        .select()
        .from(scenes)
        .where(eq(scenes.id, request.params.sceneId))
        .get();

      if (!scene || scene.projectId !== request.params.projectId) {
        return reply.status(404).send({
          success: false,
          error: "Scene not found for this project",
        });
      }

      // Fallback 1: strip 三宫格综合预览
      const stripPath = getStripPath(request.params.projectId, request.params.sceneId);
      if (existsSync(stripPath)) {
        return reply.type("image/png").send(readFileSync(stripPath));
      }

      // Fallback 2/3: panel0 → 任意 ready panel
      const panels = db
        .select()
        .from(storyboardPanels)
        .where(eq(storyboardPanels.sceneId, request.params.sceneId))
        .orderBy(storyboardPanels.panelIndex)
        .all()
        .filter((p) => p.projectId === request.params.projectId)
        .filter((p) => p.status === "ready")
        .filter((p) => p.localPath && existsSync(p.localPath));

      const panel0 = panels.find((p) => p.panelIndex === 0);
      const fallbackPanel = panel0 ?? panels[0];

      if (fallbackPanel?.localPath) {
        return reply.type(fallbackPanel.mimeType ?? "image/png").send(readFileSync(fallbackPanel.localPath));
      }

      // Fallback 4: 全部不可用
      return reply.status(404).send({
        success: false,
        error: "Preview not found",
      });
    },
  );
  // ---- 9. Storyboard review approval/rejection --------------------------
  // PATCH /api/projects/:projectId/scenes/:sceneId/storyboard-review

  app.patch<{ Params: { projectId: string; sceneId: string } }>(
    "/projects/:projectId/scenes/:sceneId/storyboard-review",
    async (request, reply) => {
      const body = request.body as { status: string; note?: string };
      const { projectId, sceneId } = request.params;
      const { status, note } = body;

      if (!["pending", "approved", "rejected"].includes(status)) {
        return reply.status(400).send({ success: false, error: "status must be pending, approved, or rejected" });
      }

      // 校验 scene 归属
      const scene = db.select().from(scenes).where(eq(scenes.id, sceneId)).get();
      if (!scene || scene.projectId !== projectId) {
        return reply.status(404).send({ success: false, error: "Scene not found for this project" });
      }

      // 审核通过时，必须校验三张 storyboard panel 都 ready
      if (status === "approved") {
        const panels = db
          .select()
          .from(storyboardPanels)
          .where(eq(storyboardPanels.sceneId, sceneId))
          .all();
        const readyPanels = panels.filter((p) => p.status === "ready" && p.localPath && existsSync(p.localPath));
        const readyIndexes = new Set(readyPanels.map((p) => p.panelIndex));
        if (!readyIndexes.has(0) || !readyIndexes.has(1) || !readyIndexes.has(2)) {
          return reply.status(400).send({
            success: false,
            error: "故事板未完整生成，不能审核通过",
          });
        }
      }

      const now = new Date().toISOString();

      if (status === "approved") {
        db.update(scenes)
          .set({
            storyboardReviewStatus: "approved",
            storyboardApprovedAt: now,
            storyboardReviewNote: note ?? null,
            updatedAt: now,
          })
          .where(eq(scenes.id, sceneId))
          .run();
      } else if (status === "rejected") {
        db.update(scenes)
          .set({
            storyboardReviewStatus: "rejected",
            storyboardApprovedAt: null,
            storyboardReviewNote: note ?? null,
            updatedAt: now,
          })
          .where(eq(scenes.id, sceneId))
          .run();
      } else {
        // pending
        db.update(scenes)
          .set({
            storyboardReviewStatus: "pending",
            storyboardApprovedAt: null,
            storyboardReviewNote: note ?? null,
            updatedAt: now,
          })
          .where(eq(scenes.id, sceneId))
          .run();
      }

      const updated = db.select().from(scenes).where(eq(scenes.id, sceneId)).get();
      return { success: true, data: updated };
    },
  );
  // ---- 8. Serve storyboard strip image ----------------------------------
  // GET /api/projects/:projectId/scenes/:sceneId/strip

  app.get<{ Params: { projectId: string; sceneId: string } }>(
    "/projects/:projectId/scenes/:sceneId/strip",
    async (request, reply) => {
      const stripPath = getStripPath(request.params.projectId, request.params.sceneId);
      if (!existsSync(stripPath)) {
        return reply.status(404).send({ success: false, error: "Strip not found" });
      }
      return reply.type("image/png").send(readFileSync(stripPath));
    },
  );
}
