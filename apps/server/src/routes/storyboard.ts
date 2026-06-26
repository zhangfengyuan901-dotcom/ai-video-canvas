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
          import { getPanelPath, getStripPath } from "../services/storage/AssetStorageService.js";
          import { existsSync, readFileSync } from "node:fs";
          import { generateStoryboardSchema } from "@ai-video-canvas/shared";
          import type { StyleBible, PanelRole, PanelStatus, StoryboardPanel } from "@ai-video-canvas/shared";
          import { composeStoryboardStrip } from "../services/storage/StripService.js";
import { createJob } from "../services/jobs/JobService.js";
import { startStoryboardWorker } from "../services/jobs/StoryboardWorker.js";

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
    async (request) => {
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

      return reply.type("image/png").send(readFileSync(panel.localPath));
    },
  );
  // ---- 5. Serve scene preview image --------------------------------------
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
        return reply.type("image/png").send(readFileSync(fallbackPanel.localPath));
      }

      // Fallback 4: 全部不可用
      return reply.status(404).send({
        success: false,
        error: "Preview not found",
      });
    },
  );
  // ---- 6. Serve storyboard strip image ----------------------------------
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
