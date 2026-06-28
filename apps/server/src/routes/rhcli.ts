// =========================================================================
// RH CLI Routes — RunningHub 高级功能（余额、模型浏览、快捷图文生成）
// 底层使用原生 TypeScript RunningHubClient，零外部依赖
// =========================================================================

import { FastifyInstance } from "fastify";
import {
  checkBalance,
  listModels,
  runImage,
  runVideo,
} from "../services/api/RunningHubClient.js";

export async function rhCliRoutes(app: FastifyInstance) {
  // ---- GET /api/rhcli/check — 余额 + API 状态 ----------------------------

  app.get("/rhcli/check", async () => {
    const result = await checkBalance();
    return {
      success: true,
      data: {
        available: true,
        status: result.status,
        keyPrefix: result.keyPrefix,
        keySource: result.keySource,
        balance: result.balance,
        currency: result.currency,
        coins: result.coins,
        runningTasks: result.runningTasks,
      },
    };
  });

  // ---- GET /api/rhcli/models — 模型列表 -----------------------------------

  app.get<{ Querystring: { type?: string } }>(
    "/rhcli/models",
    async (request) => {
      const type = request.query.type === "video" ? "video" : "image";
      const result = listModels(type);
      return { success: true, data: result };
    },
  );

  // ---- POST /api/rhcli/image — 快捷文生图 ---------------------------------

  app.post<{ Body: { prompt: string; model?: string } }>(
    "/rhcli/image",
    async (request, reply) => {
      const { prompt, model } = request.body ?? {};
      if (!prompt || !prompt.trim()) {
        return reply.status(400).send({ success: false, error: "prompt is required" });
      }
      try {
        const result = await runImage(prompt.trim(), model);
        return { success: true, data: result };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : "Image generation failed",
        };
      }
    },
  );

  // ---- POST /api/rhcli/video — 快捷视频生成 -------------------------------

  app.post<{ Body: { prompt: string; model: string; duration?: number } }>(
    "/rhcli/video",
    async (request, reply) => {
      const { prompt, model, duration } = request.body ?? {};
      if (!prompt || !prompt.trim()) {
        return reply.status(400).send({ success: false, error: "prompt is required" });
      }
      if (!model) {
        return reply.status(400).send({ success: false, error: "model is required" });
      }
      try {
        const result = await runVideo(prompt.trim(), model, duration);
        return { success: true, data: result };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : "Video generation failed",
        };
      }
    },
  );
}
