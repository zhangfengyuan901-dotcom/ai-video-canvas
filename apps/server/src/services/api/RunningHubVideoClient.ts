// =========================================================================
// RunningHubVideoClient — RunningHub AI App 视频工作流 API 客户端
// =========================================================================

import { basename } from "node:path";
import { readFileSync, createWriteStream, existsSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { getEffectiveApiConfig } from "../settings/ApiConfigService.js";


// ---- 类型 ---------------------------------------------------------------

export interface RunningHubAiAppNodeInfo {
  nodeId: string;
  fieldName: string;
  fieldValue: string;
  description: string;
  fieldData?: string;
}

export interface RunningHubAiAppSubmitBody {
  nodeInfoList: RunningHubAiAppNodeInfo[];
  instanceType?: "default" | "plus";
  usePersonalQueue?: boolean | string;
  retainSeconds?: number;
  webhookUrl?: string;
}

export interface RunningHubTaskResult {
  url?: string;
  nodeId?: string;
  outputType?: string;
  text?: string | null;
}

export interface SubmitResponse {
  taskId: string;
}

export type TaskStatus = "QUEUED" | "RUNNING" | "SUCCESS" | "FAILED";

export interface QueryResponse {
  status: TaskStatus;
  results?: RunningHubTaskResult[];
  errorMessage?: string;
  failedReason?: unknown;
}

export interface UploadResponse {
  code?: number;
  message?: string;
  data?: {
    type?: string;
    download_url?: string;
    fileName?: string;
    size?: string;
  };
  download_url?: string;
}

// ---- AI App 常量 --------------------------------------------------------

const RUNNINGHUB_AI_APP_ID = "2037453629342355457";
const DEFAULT_RUNNINGHUB_AI_APP_RUN_URL =
  `https://www.runninghub.cn/openapi/v2/run/ai-app/${RUNNINGHUB_AI_APP_ID}`;

const IMAGE_NODE_IDS = ["2", "7", "8", "9", "10", "11", "12", "13", "14"] as const;
const VIDEO_NODE_IDS = ["3", "17", "20"] as const;
const AUDIO_NODE_IDS = ["27", "28", "29"] as const;

// ---- 参数归一化 ---------------------------------------------------------

export function normalizeRunningHubDuration(value: string): string {
  const allowed = new Set(["4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15"]);
  const normalized = String(value || "").trim();
  if (allowed.has(normalized)) return normalized;
  console.warn(`[RunningHubVideoClient] unsupported duration=${value}, fallback to 5`);
  return "5";
}

export function normalizeRunningHubRatio(value: string): string {
  const allowed = new Set(["adaptive", "16:9", "4:3", "1:1", "3:4", "9:16", "21:9"]);
  const normalized = String(value || "").trim();
  if (allowed.has(normalized)) return normalized;
  console.warn(`[RunningHubVideoClient] unsupported ratio=${value}, fallback to adaptive`);
  return "adaptive";
}

export function normalizeRunningHubResolution(value: string): string {
  const allowed = new Set(["480p", "720p", "1080p", "2k", "4k"]);
  const normalized = String(value || "").trim().toLowerCase();
  if (allowed.has(normalized)) return normalized;
  console.warn(`[RunningHubVideoClient] unsupported resolution=${value}, fallback to 720p`);
  return "720p";
}

// ---- nodeInfoList 构建器 ------------------------------------------------

export function buildRunningHubAiAppNodeInfoList(input: {
  prompt: string;
  imageUrls: string[];
  videoUrls?: string[];
  audioUrls?: string[];
  aspectRatio: string;
  resolution: string;
  duration: string;
  realPersonMode?: boolean;
}): RunningHubAiAppNodeInfo[] {
  const nodeInfoList: RunningHubAiAppNodeInfo[] = [];

  const normalizedImageUrls = input.imageUrls.slice(0, IMAGE_NODE_IDS.length);
  const normalizedVideoUrls = (input.videoUrls ?? []).slice(0, VIDEO_NODE_IDS.length);
  const normalizedAudioUrls = (input.audioUrls ?? []).slice(0, AUDIO_NODE_IDS.length);

  for (let i = 0; i < IMAGE_NODE_IDS.length; i++) {
    nodeInfoList.push({
      nodeId: IMAGE_NODE_IDS[i],
      fieldName: "image",
      fieldValue: normalizedImageUrls[i] ?? "None",
      description: `上传图像${i + 1}`,
    });
  }

  for (let i = 0; i < VIDEO_NODE_IDS.length; i++) {
    nodeInfoList.push({
      nodeId: VIDEO_NODE_IDS[i],
      fieldName: "file",
      fieldValue: normalizedVideoUrls[i] ?? "None",
      description: `上传视频${i + 1}`,
    });
  }

  for (let i = 0; i < AUDIO_NODE_IDS.length; i++) {
    nodeInfoList.push({
      nodeId: AUDIO_NODE_IDS[i],
      fieldName: "audio",
      fieldValue: normalizedAudioUrls[i] ?? "None",
      description: `上传音频${i + 1}`,
    });
  }

  nodeInfoList.push({
    nodeId: "1",
    fieldName: "real_person_mode",
    fieldValue: input.realPersonMode === false ? "false" : "true",
    description: "支持真人开关",
  });

  nodeInfoList.push({
    nodeId: "1",
    fieldName: "duration",
    fieldData: "[[\"4\", \"5\", \"6\", \"7\", \"8\", \"9\", \"10\", \"11\", \"12\", \"13\", \"14\", \"15\"], {\"default\": \"5\"}]",
    fieldValue: normalizeRunningHubDuration(input.duration),
    description: "时长（秒）",
  });

  nodeInfoList.push({
    nodeId: "1",
    fieldName: "ratio",
    fieldData: "[[\"adaptive\", \"16:9\", \"4:3\", \"1:1\", \"3:4\", \"9:16\", \"21:9\"], {\"default\": \"adaptive\"}]",
    fieldValue: normalizeRunningHubRatio(input.aspectRatio),
    description: "比例",
  });

  nodeInfoList.push({
    nodeId: "1",
    fieldName: "resolution",
    fieldData: "[[\"480p\", \"720p\", \"1080p\", \"2k\", \"4k\"], {\"default\": \"720p\"}]",
    fieldValue: normalizeRunningHubResolution(input.resolution),
    description: "分辨率",
  });

  nodeInfoList.push({
    nodeId: "1",
    fieldName: "prompt",
    fieldValue: input.prompt,
    description: "输入文本",
  });

  return nodeInfoList;
}

// ---- 工具：文件 → Base64 Data URI ---------------------------------------

export function fileToDataUri(filePath: string, mimeType = "image/png"): string {
  const buffer = readFileSync(filePath);
  const b64 = buffer.toString("base64");
  return `data:${mimeType};base64,${b64}`;
}

// ---- 上传图片到 RunningHub 临时存储（multipart form-data）-----------------

export async function uploadBinary(filePath: string): Promise<string> {
  const config = getEffectiveApiConfig().runninghub;
  if (!config.apiKey) {
    throw new Error("RunningHub API Key 未配置，请先在 API 配置中设置");
  }

  if (!existsSync(filePath)) {
    throw new Error(`RunningHub upload file not found: ${filePath}`);
  }

  const uploadUrl =
    config.uploadUrl || "https://www.runninghub.cn/openapi/v2/media/upload/binary";

  const buffer = readFileSync(filePath);
  const form = new FormData();
  const blob = new Blob([new Uint8Array(buffer)]);
  form.append("file", blob, basename(filePath));

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: form,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`RunningHub upload failed (${response.status}): ${body}`);
  }

  const json = (await response.json()) as UploadResponse;
  const downloadUrl = json.data?.download_url ?? json.download_url;

  if (!downloadUrl) {
    throw new Error(`RunningHub upload returned no download_url: ${JSON.stringify(json)}`);
  }

  return downloadUrl;
}

// ---- 批量上传多张图片 ----------------------------------------------------

export async function uploadMultipleBinaries(filePaths: string[]): Promise<string[]> {
  return Promise.all(filePaths.map((p) => uploadBinary(p)));
}

// ---- 提交 AI App 视频任务 ------------------------------------------------

export async function submitVideoTask(
  prompt: string,
  imageUrls: string[],
  aspectRatio: string = "16:9",
  resolution: string = "720p",
  duration: string = "8",
): Promise<string> {
  const config = getEffectiveApiConfig().runninghub;
  if (!config.apiKey) {
    throw new Error("RunningHub API Key 未配置，请先在 API 配置中设置");
  }

  if (!imageUrls.length) {
    throw new Error("RunningHub AI App 至少需要 1 张图片输入");
  }

  const submitUrl = config.submitUrl || DEFAULT_RUNNINGHUB_AI_APP_RUN_URL;

  const body: RunningHubAiAppSubmitBody = {
    nodeInfoList: buildRunningHubAiAppNodeInfoList({
      prompt,
      imageUrls,
      aspectRatio,
      resolution,
      duration,
      realPersonMode: true,
    }),
    instanceType: "default",
    usePersonalQueue: false,
  };

  const response = await fetch(submitUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const responseBody = await response.text();
    throw new Error(`RunningHub AI App submit failed (${response.status}): ${responseBody}`);
  }

  const json = (await response.json()) as SubmitResponse & {
    status?: TaskStatus;
    errorCode?: string;
    errorMessage?: string;
    clientId?: string;
    promptTips?: string;
  };

  if (!json.taskId) {
    throw new Error(`RunningHub AI App submit returned no taskId: ${JSON.stringify(json)}`);
  }

  console.log(
    `  [RunningHubVideoClient] AI App submitted: task=${json.taskId}, images=${imageUrls.length}, ratio=${aspectRatio}, resolution=${resolution}, duration=${duration}`,
  );

  return json.taskId;
}

// ---- 查询任务状态 --------------------------------------------------------

export async function queryTaskStatus(taskId: string): Promise<QueryResponse> {
  const config = getEffectiveApiConfig().runninghub;
  if (!config.apiKey) {
    throw new Error("RunningHub API Key 未配置，请先在 API 配置中设置");
  }

  const queryUrl = config.queryUrl || "https://www.runninghub.cn/openapi/v2/query";
  const response = await fetch(queryUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({ taskId }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`RunningHub query failed (${response.status}): ${body}`);
  }

  return (await response.json()) as QueryResponse;
}

// ---- 下载视频到本地 ------------------------------------------------------

export async function downloadVideo(remoteUrl: string, localPath: string): Promise<void> {
  const response = await fetch(remoteUrl);
  if (!response.ok || !response.body) {
    throw new Error(`Video download failed (${response.status})`);
  }
  await pipeline(Readable.fromWeb(response.body as any), createWriteStream(localPath));
}

// ---- 检查 API Key 是否可用 ------------------------------------------------

export function hasApiKey(): boolean {
  const config = getEffectiveApiConfig().runninghub;
  return !!config.apiKey && config.apiKey !== "your_runninghub_key";
}
