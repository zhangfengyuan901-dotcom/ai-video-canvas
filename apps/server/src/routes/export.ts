// =========================================================================
// Export API Routes — 异步导出 + 文件下载
// =========================================================================

import { FastifyInstance } from "fastify";
import { existsSync, createReadStream, statSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { projects } from "../db/schema.js";
import { createJob } from "../services/jobs/JobService.js";
import { startExportWorker } from "../services/jobs/ExportWorker.js";
import { buildExportPreflight } from "../services/export/ExportPreflightService.js";

const DATA_ROOT = resolve(import.meta.dirname, "../../../../local-data");

export async function exportRoutes(app: FastifyInstance) {
  // POST /api/projects/:projectId/export — 异步导出完整视频

  app.post<{ Params: { projectId: string } }>(
    "/projects/:projectId/export",
    async (request, reply) => {
      const project = db.select().from(projects).where(eq(projects.id, request.params.projectId)).get();
      if (!project) {
        return reply.status(404).send({ success: false, error: "Project not found" });
      }

      const body = (request.body ?? {}) as { allowPartial?: boolean };
      const job = createJob(request.params.projectId, "EXPORT_VIDEO", {
        allowPartial: body.allowPartial ?? false,
      });
      startExportWorker(job.id, request.params.projectId, body.allowPartial);

      return { success: true, data: { jobId: job.id, status: job.status } };
    },
  );

  // GET /api/projects/:projectId/export/preflight — 导出预检

  app.get<{ Params: { projectId: string } }>(
    "/projects/:projectId/export/preflight",
    async (request, reply) => {
      const project = db.select().from(projects).where(eq(projects.id, request.params.projectId)).get();
      if (!project) {
        return reply.status(404).send({ success: false, error: "Project not found" });
      }

      const preflight = buildExportPreflight(request.params.projectId);
      return { success: true, data: preflight };
    },
  );
  // GET /api/projects/:projectId/exports/:filename — 下载导出文件（防路径穿越）

  app.get<{ Params: { projectId: string; filename: string } }>(
    "/projects/:projectId/exports/:filename",
    async (request, reply) => {
      const filename = request.params.filename;
      if (!filename.endsWith(".mp4") || filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
        return reply.status(400).send({ success: false, error: "Invalid filename" });
      }

      const filePath = resolve(DATA_ROOT, "projects", `project-${request.params.projectId}`, "exports", filename);
      if (!existsSync(filePath)) {
        return reply.status(404).send({ success: false, error: "File not found" });
      }

      const stat = statSync(filePath);
      const range = request.headers.range;

      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
        reply
          .status(206)
          .header("Content-Range", `bytes ${start}-${end}/${stat.size}`)
          .header("Accept-Ranges", "bytes")
          .header("Content-Length", end - start + 1)
          .type("video/mp4");
        return reply.send(createReadStream(filePath, { start, end }));
      }

      return reply.type("video/mp4").send(createReadStream(filePath));
    },
  );

  // GET /api/projects/:projectId/exports — 导出列表

  app.get<{ Params: { projectId: string } }>(
    "/projects/:projectId/exports",
    async (request) => {
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
