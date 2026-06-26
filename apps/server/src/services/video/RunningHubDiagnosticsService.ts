// =========================================================================
// RunningHubDiagnosticsService
// =========================================================================
// 从 RunningHub query result 提取可持久化诊断字段，
// 避免 VideoService 里塞大量拼接逻辑。
// =========================================================================

import type {
  QueryResponse,
  RunningHubTaskResult,
} from "../api/RunningHubVideoClient.js";

// ---- 安全 JSON 序列化 ----------------------------------------------------

export function safeJsonStringify(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ unserializable: true });
  }
}

// ---- 选取主要输出结果 ----------------------------------------------------

export function pickPrimaryRunningHubResult(
  results: RunningHubTaskResult[] | undefined,
): RunningHubTaskResult | undefined {
  if (!results || results.length === 0) return undefined;

  const mp4 = results.find((r) => r.outputType === "mp4");
  if (mp4) return mp4;

  const videoByUrl = results.find((r) => r.url?.toLowerCase().includes(".mp4"));
  if (videoByUrl) return videoByUrl;

  return results[0];
}

// ---- 构建诊断字段 ---------------------------------------------------------

export function buildRunningHubDiagnostics(
  result: QueryResponse,
): {
  runninghubStatus: string | null;
  runninghubErrorCode: string | null;
  runninghubErrorMessage: string | null;
  runninghubFailedReasonJson: string | null;
  runninghubUsageJson: string | null;
  runninghubResultsJson: string | null;
  runninghubPromptTips: string | null;
  runninghubOutputNodeId: string | null;
  runninghubOutputType: string | null;
  runninghubTaskCostTime: string | null;
} {
  const primary = pickPrimaryRunningHubResult(result.results);

  return {
    runninghubStatus: result.status ?? null,
    runninghubErrorCode: result.errorCode ?? null,
    runninghubErrorMessage: result.errorMessage ?? null,
    runninghubFailedReasonJson: safeJsonStringify(result.failedReason),
    runninghubUsageJson: safeJsonStringify(result.usage),
    runninghubResultsJson: safeJsonStringify(result.results),
    runninghubPromptTips: result.promptTips ?? null,
    runninghubOutputNodeId: primary?.nodeId ?? null,
    runninghubOutputType: primary?.outputType ?? null,
    runninghubTaskCostTime:
      result.usage?.taskCostTime === undefined || result.usage?.taskCostTime === null
        ? null
        : String(result.usage.taskCostTime),
  };
}
