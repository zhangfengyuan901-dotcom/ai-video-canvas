// =========================================================================
// Export API Routes — FFmpeg 导出
// =========================================================================

import { FastifyInstance } from "fastify";
import { exportProjectVideo } from "../services/export/ExportService.js";

export async function exportRoutes(app: FastifyInstance) {
  // POST /api/projects/:projectId/export — 导出完整视频

  app.post<{ Params: { projectId: string } }>(
    "/projects/:projectId/export",
    async (request, reply) => {
      try {
        const result = await exportProjectVideo(request.params.projectId);
        if (!result.success) {
          return reply.status(400).send({ success: false, error: result.error, data: result });
        }
        return { success: true, data: result };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Export failed";
        request.log.error({ err }, "Export failed");
        return reply.status(500).send({ success: false, error: msg });
      }
    },
  );

  // GET /api/projects/:projectId/exports
  app.get<{ Params: { projectId: string } }>(
    "/projects/:projectId/exports",
    async (request) => {
      const { readdirSync } = await import("node:fs");
      const { resolve } = await import("node:path");
      const DATA_ROOT = resolve(import.meta.dirname, "../../../../local-data");
      const exportDir = resolve(DATA_ROOT, "projects", `project-${request.params.projectId}`, "exports");
      try {
        const files = readdirSync(exportDir).filter((f) => f.endsWith(".mp4"));
        return { success: true, data: files };
      } catch {
        return { success: true, data: [] };
      }
    },
  );
}
