// =========================================================================
// Chat + Script Generation Routes
// =========================================================================

import { FastifyInstance } from "fastify";
import { v4 as uuid } from "uuid";
import { db } from "../db/index.js";
import { projects, scenes, storyboardPanels, videoClips, referenceAssets } from "../db/schema.js";
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
                // 读取参考图信息，加入 prompt 上下文
        const refAssets = db
          .select()
          .from(referenceAssets)
          .where(eq(referenceAssets.projectId, project.id))
          .all();

        let refContext = "";
        if (refAssets.length > 0) {
          const refLines = refAssets
            .filter((a) => a.description || a.label)
            .map((a) => {
              const typeLabel: Record<string, string> = {
                character: "人物参考图", scene: "场景参考图", product: "产品参考图",
                first_frame: "首帧参考图", style: "风格参考图", other: "参考图",
              };
              return `${typeLabel[a.type] ?? "参考图"}：${a.label ?? "无标签"}\n   描述：${a.description ?? "用户已上传该类型参考图但未填写详细说明。生成脚本时保持该类型元素一致。"}`;
            });
          if (refLines.length > 0) {
            refContext = `\n\n项目参考素材：\n${refLines.join("\n")}\n\n要求：\n1. 如果有人物参考图说明，则所有出现该人物的镜头要保持一致\n2. 如果有场景参考图说明，则场景风格要保持一致\n3. 如果有产品参考图说明，则产品露出方式要稳定，不要凭空改变包装、颜色、形状\n4. 如果有首帧参考图说明，则第一段镜头尽量贴合首帧画面\n5. 每个镜头仍要输出结构化 JSON`;
          }
        }

        // 调用 GPT 生成脚本（加入参考图上下文）
        const enhancedMessage = refContext ? `${parsed.data.message}\n\n${refContext}` : parsed.data.message;
        const script: GptScriptOutput = await generateScript(enhancedMessage);

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
