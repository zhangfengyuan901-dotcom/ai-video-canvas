// =========================================================================
// JobService — 统一任务记录管理
// =========================================================================

import { v4 as uuid } from "uuid";
import { eq, desc } from "drizzle-orm";
import { db } from "../../db/index.js";
import { jobs } from "../../db/schema.js";

export type JobRow = typeof jobs.$inferSelect;
export type JobStatus = "queued" | "running" | "success" | "failed" | "cancelled";

// ---- Create ------------------------------------------------------------

export function createJob(
  projectId: string,
  type: string,
  payload: unknown = {},
): JobRow {
  const now = new Date().toISOString();
  const row: typeof jobs.$inferInsert = {
    id: uuid(),
    projectId,
    type,
    payloadJson: JSON.stringify(payload),
    status: "queued",
    progress: 0,
    createdAt: now,
    updatedAt: now,
  };
  db.insert(jobs).values(row).run();
  return db.select().from(jobs).where(eq(jobs.id, row.id)).get()!;
}

// ---- Read --------------------------------------------------------------

export function getJob(jobId: string): JobRow | undefined {
  return db.select().from(jobs).where(eq(jobs.id, jobId)).get() ?? undefined;
}

export function listProjectJobs(projectId: string): JobRow[] {
  return db
    .select()
    .from(jobs)
    .where(eq(jobs.projectId, projectId))
    .orderBy(desc(jobs.createdAt))
    .all();
}

// ---- Status helpers ----------------------------------------------------

export function updateJob(id: string, updates: Partial<typeof jobs.$inferInsert>): void {
  db.update(jobs)
    .set({ ...updates, updatedAt: new Date().toISOString() })
    .where(eq(jobs.id, id))
    .run();
}

export function markRunning(id: string): void {
  updateJob(id, { status: "running" as JobStatus });
}

export function markProgress(id: string, progress: number): void {
  updateJob(id, { progress });
}

export function markSuccess(id: string, result?: unknown): void {
  updateJob(id, {
    status: "success" as JobStatus,
    progress: 100,
    resultJson: result ? JSON.stringify(result) : undefined,
  });
}

export function markFailed(id: string, error: string): void {
  updateJob(id, {
    status: "failed" as JobStatus,
    error,
  });
}

export function markCancelled(id: string): void {
  updateJob(id, {
    status: "cancelled" as JobStatus,
  });
}
