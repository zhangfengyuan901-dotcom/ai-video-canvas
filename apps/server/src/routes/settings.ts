// =========================================================================
// Settings API Routes — API 配置管理
// 安全：GET 不返回真实 API Key
// =========================================================================

import { FastifyInstance } from "fastify";
import {
  getSafeApiConfig,
  saveApiConfigPatch,
  checkApiConfig,
  type ApiConfigPatch,
} from "../services/settings/ApiConfigService.js";

export async function settingsRoutes(app: FastifyInstance) {
  // ---- 1. 读取 API 配置状态（安全，不含真实 key）---------------------------
  // GET /api/settings/api

  app.get("/settings/api", async () => ({
    success: true,
    data: getSafeApiConfig(),
  }));

  // ---- 2. 保存 API 配置 -------------------------------------------------
  // PUT /api/settings/api

  app.put("/settings/api", async (request, reply) => {
    const body = (request.body ?? {}) as ApiConfigPatch;

    // 验证：URL 字段不为空
    if (body.packy?.baseUrl !== undefined && !body.packy.baseUrl.trim()) {
      return reply.status(400).send({ success: false, error: "Packy baseUrl is required" });
    }
    if (body.runninghub?.submitUrl !== undefined && !body.runninghub.submitUrl.trim()) {
      return reply.status(400).send({ success: false, error: "RunningHub submitUrl is required" });
    }
    if (body.runninghub?.queryUrl !== undefined && !body.runninghub.queryUrl.trim()) {
      return reply.status(400).send({ success: false, error: "RunningHub queryUrl is required" });
    }
    if (body.runninghub?.uploadUrl !== undefined && !body.runninghub.uploadUrl.trim()) {
      return reply.status(400).send({ success: false, error: "RunningHub uploadUrl is required" });
    }

    try {
      const result = saveApiConfigPatch(body);
      return { success: true, data: result };
    } catch (err) {
      return reply.status(500).send({
        success: false,
        error: "Failed to save API config",
      });
    }
  });

  // ---- 3. 配置自检（轻量，不调用真实接口）---------------------------------
  // POST /api/settings/api/check

  app.post("/settings/api/check", async () => ({
    success: true,
    data: checkApiConfig(),
  }));
}
