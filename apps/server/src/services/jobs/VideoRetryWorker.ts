// =========================================================================
// VideoRetryWorker - async failed video retry worker
// Creates retry clips via JobService async, without blocking HTTP requests.
// =========================================================================

import { retryFailedClip } from "../VideoService.js";
import { getJob, markRunning, markProgress, markSuccess, markFailed } from "./JobService.js";

export async function runVideoRetryJob(
  jobId: string,
  params: {
    projectId: string;
    sceneId: string;
    clipId: string;
    retryReason?: string;
  },
): Promise<void> {
  try {
    markRunning(jobId);
    markProgress(jobId, 10);

    const clip = await retryFailedClip(params);

    markProgress(jobId, 80);

    markSuccess(jobId, {
      clipId: clip.id,
      sourceClipId: params.clipId,
      sceneId: params.sceneId,
      projectId: params.projectId,
      version: clip.version,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Retry failed";
    markFailed(jobId, msg);
  }
}

export function startVideoRetryWorker(
  jobId: string,
  params: {
    projectId: string;
    sceneId: string;
    clipId: string;
    retryReason?: string;
  },
): void {
  setTimeout(() => {
    runVideoRetryJob(jobId, params).catch((err) => {
      console.error("[VideoRetryWorker] fatal error:", err);
    });
  }, 0);
}
