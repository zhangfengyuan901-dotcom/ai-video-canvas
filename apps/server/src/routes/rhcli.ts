// =========================================================================
// RH CLI Routes — 包装 RunningHub CLI 的高级功能
// =========================================================================

import { FastifyInstance } from "fastify";
import { rhCheck, rhListModels, rhRunImage, rhRunVideo } from "../services/rh-cli/RhCliService.js";

export async function rhCliRoutes(app: FastifyInstance) {
  // ---- GET /api/rhcli/check — 余额 + API 状态 ----------------------------

  app.get("/rhcli/check", async () => {
    const result = await rhCheck();
    return { success: true, data: result };
  });

  // ---- GET /api/rhcli/models — 模型列表 -----------------------------------

  app.get<{ Querystring: { type?: string } }>("/rhcli/models", async (request) => {
    const type = request.query.type === "video" ? "video" : "image";
    const result = await rhListModels(type);
    return { success: true, data: result };
  });

  // ---- POST /api/rhcli/image — 快捷文生图 ---------------------------------

  app.post<{ Body: { prompt: string; model?: string } }>(
    "/rhcli/image",
    async (request, reply) => {
      const { prompt, model } = request.body ?? {};
      if (!prompt || !prompt.trim()) {
        return reply.status(400).send({ success: false, error: "prompt is required" });
      }
      const result = await rhRunImage(prompt.trim(), model);
      return { success: !result.error, data: result, error: result.error };
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
      const result = await rhRunVideo(prompt.trim(), model, duration);
      return { success: !result.error, data: result, error: result.error };
    },
  );
}
