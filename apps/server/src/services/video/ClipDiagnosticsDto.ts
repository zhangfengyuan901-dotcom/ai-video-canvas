// =========================================================================
// ClipDiagnosticsDto -- db row -> frontend readable DTO
// =========================================================================
// Map JSON string fields in video_clips and runninghub_* columns
// to RunningHubClipDiagnostics and VideoClip DTO,
// so frontend does not depend on DB column names directly.
// =========================================================================

import type {
  RunningHubClipDiagnostics,
  RunningHubTaskResultDto,
  RunningHubTaskUsageDto,
  VideoClip,
} from "@ai-video-canvas/shared";

// ---- Safe JSON parsing ----------------------------------------------------

export function safeParseJson<T = unknown>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function safeParseStringArray(value: string | null | undefined): string[] {
  const parsed = safeParseJson<unknown>(value);
  return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
}

// ---- Summary utilities -----------------------------------------------------------

function summarizeText(value: string | null | undefined, maxLength: number): string | null {
  if (!value) return null;
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

// ---- Build diagnostics DTO --------------------------------------------------------

export function buildClipDiagnosticsDto(
  row: any,
  options: { includeFull?: boolean } = {},
): RunningHubClipDiagnostics {
  const includeFull = options.includeFull ?? false;

  const usage = safeParseJson<RunningHubTaskUsageDto>(row.runninghubUsageJson);
  const results = safeParseJson<RunningHubTaskResultDto[]>(row.runninghubResultsJson);
  const failedReason = safeParseJson<unknown>(row.runninghubFailedReasonJson);

  return {
    status: row.runninghubStatus ?? null,
    errorCode: row.runninghubErrorCode ?? null,
    errorMessage: row.runninghubErrorMessage ?? null,
    failedReason: includeFull ? failedReason : null,
    usage: includeFull
      ? usage
      : usage
        ? {
            taskCostTime: usage.taskCostTime ?? null,
            consumeMoney: usage.consumeMoney ?? null,
            consumeCoins: usage.consumeCoins ?? null,
            thirdPartyConsumeMoney: usage.thirdPartyConsumeMoney ?? null,
          }
        : null,
    results: includeFull ? results : null,
    promptTips: includeFull ? (row.runninghubPromptTips ?? null) : summarizeText(row.runninghubPromptTips, 240),
    outputNodeId: row.runninghubOutputNodeId ?? null,
    outputType: row.runninghubOutputType ?? null,
    taskCostTime: row.runninghubTaskCostTime ?? null,
    lastPolledAt: row.lastPolledAt ?? null,
    completedAt: row.completedAt ?? null,
  };
}

// ---- Complete VideoClip DTO --------------------------------------------------

export function toVideoClipDto(
  row: any,
  currentClipIdForScene?: string,
  options: { includeFullDiagnostics?: boolean } = {},
): VideoClip {
  return {
    id: row.id,
    projectId: row.projectId,
    sceneId: row.sceneId,
    order: row.order,
    version: row.version,
    prompt: row.prompt,
    taskId: row.taskId ?? undefined,
    remoteUrl: row.remoteUrl ?? undefined,
    localPath: row.localPath ?? undefined,
    duration: row.duration,
    resolution: row.resolution,
    aspectRatio: row.aspectRatio,
    retryOfClipId: row.retryOfClipId ?? null,
    retryReason: row.retryReason ?? null,
    retryCreatedAt: row.retryCreatedAt ?? null,
    inputPanelIds: safeParseStringArray(row.inputPanelIdsJson),
    status: row.status,
    error: row.error ?? undefined,
    isCurrent: currentClipIdForScene === row.id,
    reviewStatus: row.reviewStatus ?? undefined,
    reviewNote: row.reviewNote ?? undefined,
    approvedAt: row.approvedAt ?? undefined,
    rejectedAt: row.rejectedAt ?? undefined,
    diagnostics: buildClipDiagnosticsDto(row, {
      includeFull: options.includeFullDiagnostics ?? false,
    }),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}