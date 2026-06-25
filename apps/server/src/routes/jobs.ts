// =========================================================================
// Job API Routes
// =========================================================================

import { FastifyInstance } from "fastify";
import { getJob, listProjectJobs, markCancelled } from "../services/jobs/JobService.js";

export async function jobRoutes(app: FastifyInstance) {
  // GET /api/projects/:projectId/jobs — 项目任务列表

  app.get<{ Params: { projectId: string } }>(
    "/projects/:projectId/jobs",
    async (request) => {
      const rows = listProjectJobs(request.params.projectId);
      return { success: true, data: rows };
    },
  );

  // GET /api/jobs/:jobId — 单个任务状态

  app.get<{ Params: { jobId: string } }>(
    "/jobs/:jobId",
    async (request, reply) => {
      const job = getJob(request.params.jobId);
      if (!job) {
        return reply.status(404).send({ success: false, error: "Job not found" });
      }
      return { success: true, data: job };
    },
  );

  // POST /api/jobs/:jobId/cancel — 取消任务

  app.post<{ Params: { jobId: string } }>(
    "/jobs/:jobId/cancel",
    async (request, reply) => {
      const job = getJob(request.params.jobId);
      if (!job) {
        return reply.status(404).send({ success: false, error: "Job not found" });
      }
      if (job.status === "success" || job.status === "failed" || job.status === "cancelled") {
        return reply.status(400).send({ success: false, error: `Job already ${job.status}` });
      }
      markCancelled(request.params.jobId);
      return { success: true, data: { jobId: request.params.jobId, status: "cancelled" } };
    },
  );
}
