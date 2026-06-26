// =========================================================================
// ClipDiagnosticsDto — 数据库 row → 前端可读 DTO
// =========================================================================
// 把 video_clips 中的 JSON 字符串字段和 runninghub_* 列
// 转换成 RunningHubClipDiagnostics 和 VideoClip DTO，
// 避免前端直接依赖数据库字段名。
// =========================================================================

import type {
  RunningHubClipDiagnostics,
  RunningHubTaskResultDto,
  RunningHubTaskUsageDto,
  VideoClip,
} from "@ai-video-canvas/shared";

// ---- 安全 JSON 解析 ----------------------------------------------------

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

// ---- 摘要工具 -----------------------------------------------------------

function summarizeText(value: string | null | undefined, maxLength: number): string | null {
  if (!value) return null;
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

// ---- 构建诊断 DTO --------------------------------------------------------

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

// ---- 完整 VideoClip DTO --------------------------------------------------

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
    inputPanelIds: safeParseStringArray(row.inputPanelIdsJson),
    status: row.status,
    error: row.error ?? undefined,
    isCurrent: currentClipIdForScene === row.id,
    diagnostics: buildClipDiagnosticsDto(row, {
      includeFull: options.includeFullDiagnostics ?? false,
    }),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}