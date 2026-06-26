// =========================================================================
// runninghubDiagnostics — RunningHub 诊断工具函数
// JSON 格式化、错误分类、重试建议、URL 截断、复制文本构造
// =========================================================================

import type { RunningHubClipDiagnostics, VideoClip } from "@ai-video-canvas/shared";

export type RunningHubIssueSeverity = "info" | "warning" | "error";

export type RunningHubIssueCode =
  | "NO_ERROR"
  | "API_KEY_OR_AUTH"
  | "INSUFFICIENT_INPUT"
  | "INVALID_NODE_INPUT"
  | "PROMPT_VALIDATION_FAILED"
  | "OUTPUT_NOT_VIDEO"
  | "TASK_TIMEOUT"
  | "RUNNINGHUB_INTERNAL"
  | "NETWORK_OR_POLLING"
  | "UNKNOWN_FAILED";

export interface RunningHubRetryGuidance {
  code: RunningHubIssueCode;
  severity: RunningHubIssueSeverity;
  title: string;
  message: string;
  actions: string[];
  canRetry: boolean;
}

// ---- JSON 工具 ----------------------------------------------------------

export function tryParseJson(value: unknown): unknown | null {
  if (!value) return null;
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return null; }
}

export function prettyJson(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  try {
    var parsed = typeof value === "string" ? (tryParseJson(value) ?? value) : value;
    return typeof parsed === "string" ? parsed : JSON.stringify(parsed, null, 2);
  } catch { return "[unserializable]"; }
}

// ---- 格式化工具 ---------------------------------------------------------

export function truncateMiddle(value: string, max?: number): string {
  if (!max) max = 80;
  if (value.length <= max) return value;
  var head = Math.floor(max * 0.45);
  var tail = Math.floor(max * 0.45);
  return value.slice(0, head) + "..." + value.slice(-tail);
}

export function redactUrl(value: string | undefined | null): string | null {
  if (!value) return null;
  return "..." + value.slice(-32);
}

export function formatPromptTips(value: string | null | undefined): {
  raw: string | null;
  parsed: unknown | null;
  pretty: string | null;
} {
  if (!value) return { raw: null, parsed: null, pretty: null };
  var parsed = tryParseJson(value);
  return { raw: value, parsed: parsed, pretty: parsed ? prettyJson(parsed) : value };
}

export function formatFailedReason(value: unknown): {
  pretty: string | null;
  summary: string | null;
} {
  var pretty = prettyJson(value);
  if (!pretty) return { pretty: null, summary: null };
  return { pretty: pretty, summary: pretty.length > 240 ? pretty.slice(0, 240) + "..." : pretty };
}

// ---- 错误分类与重试建议 --------------------------------------------------

export function buildRunningHubRetryGuidance(
  clip: VideoClip,
  diagnostics: RunningHubClipDiagnostics | null | undefined,
): RunningHubRetryGuidance {
  var status = diagnostics?.status;
  var errorCode = diagnostics?.errorCode ?? "";
  var errorMessage = diagnostics?.errorMessage ?? clip.error ?? "";
  var failedReasonText = prettyJson(diagnostics?.failedReason) ?? "";
  var promptTips = diagnostics?.promptTips ?? "";
  var allText = (status + " " + errorCode + " " + errorMessage + " " + failedReasonText + " " + promptTips).toLowerCase();

  if (clip.status !== "failed" && status !== "FAILED") {
    return { code: "NO_ERROR", severity: "info", title: "任务未失败", message: "当前任务没有明确失败状态，可继续等待或刷新诊断。", actions: ["如果任务长时间停留在 RUNNING，可稍后刷新诊断。"], canRetry: false };
  }
  if (allText.includes("unauthorized") || allText.includes("forbidden") || allText.includes("api key") || allText.includes("401") || allText.includes("403")) {
    return { code: "API_KEY_OR_AUTH", severity: "error", title: "鉴权或 API Key 异常", message: "RunningHub 返回鉴权相关错误，通常不是重试能解决的问题。", actions: ["检查 RUNNINGHUB_API_KEY 是否配置正确。", "确认当前 key 是否仍有效。", "确认账号是否有权限调用该 AI App。"], canRetry: false };
  }
  if (allText.includes("image") && (allText.includes("none") || allText.includes("missing") || allText.includes("empty"))) {
    return { code: "INSUFFICIENT_INPUT", severity: "error", title: "输入素材不足或为空", message: "AI App 可能没有收到有效图片输入。", actions: ["确认该镜头 panelIndex 0/1/2 三张图都已 ready。", "确认本地文件存在。", "重新生成故事板后再生成视频。"], canRetry: true };
  }
  if (allText.includes("node") || allText.includes("field") || allText.includes("node_errors")) {
    return { code: "INVALID_NODE_INPUT", severity: "error", title: "工作流节点参数异常", message: "RunningHub 工作流节点校验失败，可能是 nodeInfoList 的某个字段不符合 AI App 要求。", actions: ["查看 promptTips / failedReason 中的 node_errors。", "确认图片节点、duration、ratio、resolution 是否符合 AI App 文档。", "如果是参数不支持，调整项目分辨率或比例后重新生成。"], canRetry: true };
  }
  if (allText.includes("prompt") || allText.includes("prompttips")) {
    return { code: "PROMPT_VALIDATION_FAILED", severity: "warning", title: "Prompt 或工作流提示校验异常", message: "RunningHub 返回 prompt 校验相关信息，需要检查 promptTips。", actions: ["展开 promptTips 查看具体节点提示。", "简化 motion prompt。", "避免特殊符号或过长文本后重新生成。"], canRetry: true };
  }
  if (diagnostics?.outputType && diagnostics.outputType !== "mp4") {
    return { code: "OUTPUT_NOT_VIDEO", severity: "warning", title: "输出不是 mp4 视频", message: "任务可能成功，但 AI App 返回的主要输出不是 mp4。", actions: ["检查 results 中的 outputType 和 nodeId。", "确认 RunningHub AI App 的最终输出节点是否配置为视频。", "如工作流输出节点变化，需要调整结果选择逻辑。"], canRetry: false };
  }
  if (allText.includes("timeout") || allText.includes("timed out")) {
    return { code: "TASK_TIMEOUT", severity: "warning", title: "任务超时", message: "RunningHub 任务可能执行时间过长或排队过久。", actions: ["稍后刷新诊断。", "降低 duration 或 resolution 后重试。", "如果多次超时，检查 RunningHub 队列和账号资源。"], canRetry: true };
  }
  if (allText.includes("500") || allText.includes("internal") || allText.includes("server error")) {
    return { code: "RUNNINGHUB_INTERNAL", severity: "warning", title: "RunningHub 服务端异常", message: "这类错误通常是平台侧或工作流执行侧异常。", actions: ["稍后重试。", "保留 taskId 和 failedReason 用于排查。", "如果连续失败，检查 RunningHub 控制台任务详情。"], canRetry: true };
  }
  if (clip.error && clip.status === "running") {
    return { code: "NETWORK_OR_POLLING", severity: "warning", title: "轮询或网络异常", message: "本地轮询曾出现错误，但任务未被标记为 failed。", actions: ["点击刷新诊断。", "等待下一轮后台轮询。", "确认网络和 RunningHub query endpoint 可访问。"], canRetry: false };
  }
  return { code: "UNKNOWN_FAILED", severity: "error", title: "未知失败", message: "任务失败，但暂时无法自动判断具体原因。", actions: ["复制 taskId、failedReason 和 promptTips。", "检查 RunningHub 控制台任务详情。", "确认输入图片、duration、ratio、resolution 后重新生成。"], canRetry: true };
}

// ---- 复制文本构造 --------------------------------------------------------

export function buildDiagnosticsCopyText(clip: VideoClip, diagnostics: RunningHubClipDiagnostics | null | undefined): string {
  return prettyJson({ clipId: clip.id, sceneId: clip.sceneId, projectId: clip.projectId, version: clip.version, status: clip.status, taskId: clip.taskId ?? null, error: clip.error ?? null, diagnostics: diagnostics ?? null }) ?? "";
}

export function buildErrorSummary(clip: VideoClip, diagnostics: RunningHubClipDiagnostics | null | undefined): string {
  var parts = [
    "clipId=" + clip.id,
    "taskId=" + (clip.taskId ?? ""),
    "clipStatus=" + clip.status,
    "runninghubStatus=" + (diagnostics?.status ?? ""),
    "errorCode=" + (diagnostics?.errorCode ?? ""),
    "errorMessage=" + (diagnostics?.errorMessage ?? clip.error ?? ""),
  ];
  return parts.join("\n");
}
