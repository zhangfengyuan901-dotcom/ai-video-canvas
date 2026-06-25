// =========================================================================
// Chat + Script Generation Routes
// =========================================================================

import { FastifyInstance } from "fastify";
import { v4 as uuid } from "uuid";
import { db } from "../db/index.js";
import { projects, scenes, storyboardPanels, videoClips } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { chatRequestSchema } from "@ai-video-canvas/shared";
import { generateScript } from "../services/llm/ScriptService.js";
import type { GptScriptOutput } from "@ai-video-canvas/shared";

export async function chatRoutes(app: FastifyInstance) {
  // ---- Chat: generate script from user prompt --------------------------

  app.post<{ Params: { projectId: string } }>(
    "/projects/:projectId/chat",
    async (request, reply) => {
      // 校验请求
      const parsed = chatRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: parsed.error.issues.map((i) => i.message).join(", "),
        });
      }

      // 确认项目存在
      const project = db
        .select()
        .from(projects)
        .where(eq(projects.id, request.params.projectId))
        .get();

      if (!project) {
        return reply.status(404).send({ success: false, error: "Project not found" });
      }

      try {
        // 调用 GPT 生成脚本
        const script: GptScriptOutput = await generateScript(parsed.data.message);

        // 保存 scenes 到数据库
        const now = new Date().toISOString();
        const createdScenes = script.scenes.map((s) => ({
          id: uuid(),
          projectId: project.id,
          order: s.order,
          title: s.title,
          summary: s.summary,
          scriptText: s.scriptText,
          visualDescription: s.visualDescription,
          charactersJson: JSON.stringify(s.characters),
          location: s.location,
          shotSize: s.shotSize,
          cameraAngle: s.cameraAngle,
          cameraMovement: s.cameraMovement,
          motionPrompt: s.motionPrompt,
          dialogue: s.dialogue ?? null,
          audioEffects: s.audioEffects ?? null,
          duration: s.duration ?? 8,
          status: "draft" as const,
          locked: 0,
          createdAt: now,
          updatedAt: now,
        }));

        // 删除旧 scenes，插入新的
        // 同时清理旧的 storyboard_panels 和 video_clips，避免孤儿数据
        if (createdScenes.length > 0) {
          db.delete(storyboardPanels).where(eq(storyboardPanels.projectId, project.id)).run();
          db.delete(videoClips).where(eq(videoClips.projectId, project.id)).run();
        }
        db.delete(scenes).where(eq(scenes.projectId, project.id)).run();

        if (createdScenes.length > 0) {
          db.insert(scenes).values(createdScenes).run();
        }

        // 更新项目标题和 style bible
        // 同时更新 aspectRatio / resolution（GPt输出可能和创建时不同）
        db.update(projects)
          .set({
            title: script.title,
            aspectRatio: script.aspectRatio,
            resolution: script.resolution,
            styleBibleJson: JSON.stringify(script.styleBible),
            updatedAt: now,
          })
          .where(eq(projects.id, project.id))
          .run();

        return {
          success: true,
          data: {
            title: script.title,
            aspectRatio: script.aspectRatio,
            resolution: script.resolution,
            styleBible: script.styleBible,
            scenes: createdScenes.map((s) => ({
              ...s,
              characters: JSON.parse(s.charactersJson),
              locked: false,
            })),
            sceneCount: createdScenes.length,
          },
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        request.log.error({ err }, "Script generation failed");
        return reply.status(500).send({
          success: false,
          error: message,
        });
      }
    },
  );
}
