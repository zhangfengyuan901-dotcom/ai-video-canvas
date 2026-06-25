// =========================================================================
// RunningHubVideoClient — RunningHub 图生视频 API 客户端
// 文档参考: docs/runninghub-veo-image-to-video.md
// =========================================================================

import { readFileSync, createWriteStream, existsSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

const API_KEY = process.env.RUNNINGHUB_API_KEY ?? "";
const SUBMIT_URL = "https://www.runninghub.cn/openapi/v2/rhart-video-v3.1-fast/image-to-video";
const QUERY_URL = "https://www.runninghub.cn/openapi/v2/query";
const UPLOAD_URL = "https://www.runninghub.cn/openapi/v2/media/upload/binary";

// ---- 类型 ---------------------------------------------------------------

export interface SubmitResponse {
  taskId: string;
}

export type TaskStatus = "QUEUED" | "RUNNING" | "SUCCESS" | "FAILED";

export interface QueryResponse {
  status: TaskStatus;
  results?: { url?: string; outputType?: string }[];
  errorMessage?: string;
  failedReason?: unknown;
}

export interface UploadResponse {
  download_url: string;
}

// ---- 工具：文件 → Base64 Data URI ---------------------------------------

export function fileToDataUri(filePath: string, mimeType = "image/png"): string {
  const buffer = readFileSync(filePath);
  const b64 = buffer.toString("base64");
  return `data:${mimeType};base64,${b64}`;
}
// ---- 上传图片到 RunningHub 临时存储（方案 A）-------------------------------
// 推荐方式：上传后拿 download_url 传给图生视频接口，避免 Base64 请求体过大

export async function uploadBinary(filePath: string): Promise<string> {
  if (!API_KEY) {
    throw new Error("RUNNINGHUB_API_KEY is not configured in .env");
  }

  const buffer = readFileSync(filePath);

  const response = await fetch(UPLOAD_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/octet-stream",
    },
    body: buffer,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`RunningHub upload failed (${response.status}): ${body}`);
  }

  const json = (await response.json()) as UploadResponse;

  if (!json.download_url) {
    throw new Error(`RunningHub upload returned no download_url: ${JSON.stringify(json)}`);
  }

  return json.download_url;
}

// ---- 批量上传多张图片 ----------------------------------------------------

export async function uploadMultipleBinaries(filePaths: string[]): Promise<string[]> {
  return Promise.all(filePaths.map((p) => uploadBinary(p)));
}

// ---- 提交图生视频任务 ----------------------------------------------------

export async function submitVideoTask(
  prompt: string,
  imageUrls: string[],
  aspectRatio: string = "16:9",
  resolution: string = "720p",
  duration: string = "8",
): Promise<string> {
  if (!API_KEY) {
    throw new Error("RUNNINGHUB_API_KEY is not configured in .env");
  }

  const response = await fetch(SUBMIT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      prompt,
      aspectRatio,
      imageUrls,
      duration,
      resolution,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`RunningHub submit failed (${response.status}): ${body}`);
  }

  const json = (await response.json()) as SubmitResponse;

  if (!json.taskId) {
    throw new Error(`RunningHub submit returned no taskId: ${JSON.stringify(json)}`);
  }

  return json.taskId;
}

// ---- 查询任务状态 --------------------------------------------------------

export async function queryTaskStatus(taskId: string): Promise<QueryResponse> {
  if (!API_KEY) {
    throw new Error("RUNNINGHUB_API_KEY is not configured in .env");
  }

  const response = await fetch(QUERY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
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
  return !!API_KEY && API_KEY !== "your_runninghub_key";
}
