// =========================================================================
// Storyboard API Routes — Phase 2: 三宫格故事板
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

export async function storyboardRoutes(app: FastifyInstance) {
  // ---- 1. Generate storyboard panels for scenes ------------------------
  // POST /projects/:projectId/storyboard/generate

  app.post<{ Params: { projectId: string } }>(
    "/projects/:projectId/storyboard/generate",
    async (request, reply) => {
      // 校验请求
      const parsed = generateStoryboardSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: parsed.error.issues.map((i) => i.message).join(", "),
        });
      }

      // 确认项目存在，读取 style bible
      const project = db
        .select()
        .from(projects)
        .where(eq(projects.id, request.params.projectId))
        .get();

      if (!project) {
        return reply.status(404).send({ success: false, error: "Project not found" });
      }

      if (!project.styleBibleJson) {
        return reply.status(400).send({
          success: false,
          error: "请先生成脚本（style bible 不存在），再生成故事板",
        });
      }

      const styleBible: Omit<StyleBible, "id" | "projectId"> = JSON.parse(project.styleBibleJson);
      const aspectRatio = project.aspectRatio as "16:9" | "9:16";

      // 确定要处理的 scenes
      const sceneIds = parsed.data.sceneIds;
      const sceneRows = sceneIds
        ? db.select().from(scenes).where(eq(scenes.projectId, project.id)).all()
            .filter((s) => sceneIds.includes(s.id))
            .sort((a, b) => a.order - b.order)
        : db.select().from(scenes).where(eq(scenes.projectId, project.id)).orderBy(scenes.order).all();

      if (sceneRows.length === 0) {
        return reply.status(400).send({ success: false, error: "没有找到需要处理的镜头" });
      }

      const now = new Date().toISOString();
      const allCreatedPanels: Array<Record<string, unknown>> = [];

      // 逐个场景处理
      for (const scene of sceneRows) {
        try {
          // Step 1: 解析 scene 数据为 Scene 类型
          const sceneData = {
            id: scene.id,
            projectId: scene.projectId,
            order: scene.order,
            title: scene.title,
            summary: scene.summary,
            scriptText: scene.scriptText,
            visualDescription: scene.visualDescription,
            characters: JSON.parse(scene.charactersJson),
            location: scene.location,
            shotSize: scene.shotSize,
            cameraAngle: scene.cameraAngle,
            cameraMovement: scene.cameraMovement,
            motionPrompt: scene.motionPrompt,
            dialogue: scene.dialogue ?? undefined,
            audioEffects: scene.audioEffects ?? undefined,
            duration: scene.duration,
            status: scene.status as any,
            locked: !!scene.locked,
            createdAt: scene.createdAt,
            updatedAt: scene.updatedAt,
          };

          // Step 2: 生成 3 个 panel prompts
          request.log.info(`Generating panel prompts for scene ${scene.order}: ${scene.title}`);
          const prompts = await generatePanelPrompts(sceneData, styleBible);

          // Step 3: 为每个 panel 生成图片（UPSERT + 版本化文件路径 + 跳过 locked）
          const panelRecords: Array<Record<string, unknown>> = [];

          // 预加载该 scene 现有 panel 记录
          const existingPanelRecs = db
            .select()
            .from(storyboardPanels)
            .where(eq(storyboardPanels.sceneId, scene.id))
            .all();

          for (const p of prompts) {
            const existing = existingPanelRecs.find((ep) => ep.panelIndex === p.panelIndex);

            // 如果 panel 被 locked，跳过不重生成
            if (existing && existing.locked) {
              request.log.info(`Panel ${p.panelIndex} is locked, skipping`);
              panelRecords.push({ ...existing, locked: !!existing.locked });
              continue;
            }

            const version = existing ? existing.version + 1 : 1;
            const localPath = getPanelPath(project.id, scene.id, p.panelIndex, version);
            const panelId = existing ? existing.id : uuid();

            if (existing) {
              db.update(storyboardPanels)
                .set({
                  version, localPath, prompt: p.prompt, role: p.role,
                  status: "generating",
                  revisedPrompt: null, remoteUrl: null, error: null,
                  updatedAt: now,
                })
                .where(eq(storyboardPanels.id, existing.id))
                .run();
            } else {
              db.insert(storyboardPanels)
                .values({
                  id: panelId, projectId: project.id, sceneId: scene.id,
                  panelIndex: p.panelIndex, role: p.role, prompt: p.prompt,
                  localPath, version,
                  status: "generating", locked: 0, error: null,
                  createdAt: now, updatedAt: now,
                })
                .run();
            }

            try {
              // 调用 gpt-image-2 生成并下载
              request.log.info(`Generating image for panel ${p.panelIndex} v${version} (${p.role}) of scene ${scene.order}`);
              const result = await generateAndDownload(p.prompt, localPath, aspectRatio);

              // 更新为 ready 状态
              db.update(storyboardPanels)
                .set({
                  status: "ready",
                  revisedPrompt: result.revisedPrompt ?? null,
                  remoteUrl: result.remoteUrl,
                  updatedAt: new Date().toISOString(),
                })
                .where(eq(storyboardPanels.id, panelId))
                .run();
            } catch (imgErr) {
              const imgMsg = imgErr instanceof Error ? imgErr.message : "Image generation failed";
              request.log.error({ err: imgErr, panelId }, `Panel ${p.panelIndex} v${version} generation failed`);

              db.update(storyboardPanels)
                .set({
                  status: "failed",
                  error: imgMsg,
                  updatedAt: new Date().toISOString(),
                })
                .where(eq(storyboardPanels.id, panelId))
                .run();
            }

            // 读取最终状态
            const finalPanel = db.select().from(storyboardPanels).where(eq(storyboardPanels.id, panelId)).get();
            if (finalPanel) {
              panelRecords.push({
                ...finalPanel,
                locked: !!finalPanel.locked,
              });
            }
          }

          // 更新 scene 状态
          const allReady = panelRecords.every((p) => p.status === "ready");
          if (allReady) {
            // 合成为三宫格 strip（使用 storyboard_panels.localPath）
            const allCurrent = db
              .select()
              .from(storyboardPanels)
              .where(eq(storyboardPanels.sceneId, scene.id))
              .all();
            const stripPaths = [0, 1, 2]
              .map((i) => {
                const panel = allCurrent.find((p) => p.panelIndex === i);
                return panel?.localPath;
              })
              .filter(Boolean) as string[];
            if (stripPaths.length === 3) {
              try {
                await composeStoryboardStrip(project.id, scene.id, stripPaths);
              } catch (stripErr) {
                request.log.warn({ err: stripErr, sceneId: scene.id }, "Strip composition failed (non-fatal)");
              }
            }
          }
          db.update(scenes)
            .set({
              status: allReady ? "storyboard_ready" : "failed",
              updatedAt: new Date().toISOString(),
            })
            .where(eq(scenes.id, scene.id))
            .run();

          allCreatedPanels.push(...panelRecords);
        } catch (sceneErr) {
          const sceneMsg = sceneErr instanceof Error ? sceneErr.message : "Scene processing failed";
          request.log.error({ err: sceneErr, sceneId: scene.id }, `Scene ${scene.order} processing failed`);

          db.update(scenes)
            .set({ status: "failed", updatedAt: new Date().toISOString() })
            .where(eq(scenes.id, scene.id))
            .run();
        }
      }

      return {
        success: true,
        data: {
          panels: allCreatedPanels,
          processedCount: sceneRows.length,
        },
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

      // 查询项目
      const project = db
        .select()
        .from(projects)
        .where(eq(projects.id, request.params.projectId))
        .get();

      if (!project) {
        return reply.status(404).send({ success: false, error: "Project not found" });
      }

      // 查询已有 panel 记录
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
  // ---- 5. Serve storyboard strip image ----------------------------------
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
