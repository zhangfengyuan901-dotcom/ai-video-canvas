// =========================================================================
// RunningHubClient — 统一的 RunningHub API 客户端
// 合并原有视频工作流 + RH_CLI 原生能力（余额、模型浏览、快捷图文生成）
// =========================================================================

import { existsSync, mkdirSync, createWriteStream } from "node:fs";
import { resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { getEffectiveApiConfig } from "../settings/ApiConfigService.js";
import {
  IMAGE_MODELS,
  VIDEO_MODELS,
  findImageModel,
  findVideoModel,
  type CatalogModel,
} from "./modelCatalog.js";

// ---- 类型 -----------------------------------------------------------------

export interface BalanceInfo {
  status: string;
  keyPrefix: string;
  keySource: string;
  balance: string;
  currency: string;
  coins: string;
  runningTasks: string;
}

export interface ModelListResult {
  available: boolean;
  models: CatalogModel[];
  hint?: string;
}

export interface RunResult {
  files: string[];
  cost: string;
  duration: number;
  taskId: string;
  error?: string;
}

// ---- 内部工具 -------------------------------------------------------------

const REPO_ROOT = resolve(import.meta.dirname, "../../../../../");
const OUTPUT_DIR = resolve(REPO_ROOT, "local-data", "rh-output");

function ensureOutputDir(): void {
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

function getRhConfig() {
  const config = getEffectiveApiConfig().runninghub;
  if (!config.apiKey) {
    throw new Error("RunningHub API Key not configured. Set it in Settings → API Configuration.");
  }
  return config;
}

function maskApiKey(key: string): string {
  if (key.length <= 8) return "****";
  return key.slice(0, 4) + "****" + key.slice(-4);
}

async function pollTask(
  taskId: string,
  apiKey: string,
  queryUrl: string,
  timeoutMs: number = 5 * 60 * 1000,
): Promise<{ results?: Array<{ url?: string }>; cost?: string; duration?: number }> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(queryUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ taskId }),
    });

    if (!res.ok) {
      await sleep(2000);
      continue;
    }

    const json = (await res.json()) as {
      status?: string;
      results?: Array<{ url?: string }>;
      usage?: { consumeMoney?: string | number; taskCostTime?: string | number };
      errorCode?: string;
      errorMessage?: string;
    };

    if (json.status === "SUCCESS") {
      return {
        results: json.results,
        cost: String(json.usage?.consumeMoney ?? "?"),
        duration: Number(json.usage?.taskCostTime ?? 0),
      };
    }

    if (json.status === "FAILED") {
      throw new Error(json.errorMessage ?? json.errorCode ?? "Task failed");
    }

    await sleep(2000);
  }
  throw new Error("Task timed out");
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function downloadFile(url: string, destPath: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`Download failed (${res.status})`);
  await pipeline(Readable.fromWeb(res.body as any), createWriteStream(destPath));
}

// ---- 公开 API -------------------------------------------------------------

/** 查询 RunningHub 账户余额 */
export async function checkBalance(): Promise<BalanceInfo> {
  const config = getRhConfig();

  try {
    const res = await fetch("https://www.runninghub.cn/uc/openapi/accountStatus", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({ apikey: config.apiKey }),
    });

    const json = (await res.json()) as {
      code?: number;
      msg?: string;
      data?: {
        remainMoney?: number;
        remainCoins?: number;
        currency?: string;
        currentTaskCounts?: number;
        apiType?: string;
      };
    };

    if (json.code !== 0) {
      return {
        status: "invalid_key",
        keyPrefix: maskApiKey(config.apiKey),
        keySource: "stored",
        balance: "0",
        currency: "CNY",
        coins: "0",
        runningTasks: "0",
      };
    }

    const data = json.data ?? {};
    return {
      status: (Number(data.remainMoney ?? 0) > 0 ? "ready" : "no_balance"),
      keyPrefix: maskApiKey(config.apiKey),
      keySource: "stored",
      balance: String(data.remainMoney ?? "0"),
      currency: data.currency ?? "CNY",
      coins: String(data.remainCoins ?? "0"),
      runningTasks: String(data.currentTaskCounts ?? "0"),
    };
  } catch (err) {
    return {
      status: "error",
      keyPrefix: maskApiKey(config.apiKey),
      keySource: "stored",
      balance: "?",
      currency: "CNY",
      coins: "?",
      runningTasks: "?",
    };
  }
}

/** 列出可用模型 */
export function listModels(type: "image" | "video"): ModelListResult {
  const config = getEffectiveApiConfig().runninghub;
  if (!config.apiKey) {
    return {
      available: false,
      models: [],
      hint: "RunningHub API Key not configured. Set it in Settings → API Configuration.",
    };
  }

  return {
    available: true,
    models: type === "image" ? IMAGE_MODELS : VIDEO_MODELS,
  };
}

/** 快捷图片生成 */
export async function runImage(prompt: string, model?: string): Promise<RunResult> {
  const config = getRhConfig();
  const m = model ? findImageModel(model) : IMAGE_MODELS[0];
  if (!m) throw new Error(`Unknown image model: ${model}`);

  const submitUrl = `https://www.runninghub.cn/openapi/v2/run/ai-app/${m.endpoint}`;

  // Simple text-to-image node payload
  const body = {
    nodeInfoList: [
      { nodeId: "1", fieldName: "prompt", fieldValue: prompt, description: "输入文本" },
    ],
    instanceType: "default",
  };

  const res = await fetch(submitUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Image generation submit failed (${res.status}): ${text}`);
  }

  const json = (await res.json()) as { taskId?: string };
  if (!json.taskId) throw new Error("No taskId returned");

  const queryUrl = config.queryUrl || "https://www.runninghub.cn/openapi/v2/query";
  const pollResult = await pollTask(json.taskId, config.apiKey, queryUrl);

  // Download results
  ensureOutputDir();
  const files: string[] = [];
  if (pollResult.results) {
    for (let i = 0; i < pollResult.results.length; i++) {
      const resultUrl = pollResult.results[i].url;
      if (resultUrl) {
        const ext = resultUrl.match(/\.(png|jpg|jpeg|webp)/i)?.[0] ?? ".png";
        const dest = resolve(OUTPUT_DIR, `img_${json.taskId}_${i}${ext}`);
        await downloadFile(resultUrl, dest);
        files.push(dest);
      }
    }
  }

  return {
    files,
    cost: pollResult.cost ?? "?",
    duration: pollResult.duration ?? 0,
    taskId: json.taskId,
  };
}

/** 快捷视频生成 */
export async function runVideo(
  prompt: string,
  model: string,
  duration?: number,
): Promise<RunResult> {
  const config = getRhConfig();
  const m = findVideoModel(model);
  if (!m) throw new Error(`Unknown video model: ${model}`);

  const submitUrl = `https://www.runninghub.cn/openapi/v2/run/ai-app/${m.endpoint}`;
  const dur = String(duration ?? 5);

  // Simple text-to-video node payload
  const body = {
    nodeInfoList: [
      { nodeId: "1", fieldName: "prompt", fieldValue: prompt, description: "输入文本" },
      {
        nodeId: "1",
        fieldName: "duration",
        fieldData: '[[\"4\",\"5\",\"6\",\"7\",\"8\",\"9\",\"10\",\"11\",\"12\",\"13\",\"14\",\"15\"],{\"default\":\"5\"}]',
        fieldValue: dur,
        description: "时长（秒）",
      },
    ],
    instanceType: "default",
  };

  const res = await fetch(submitUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Video generation submit failed (${res.status}): ${text}`);
  }

  const json = (await res.json()) as { taskId?: string };
  if (!json.taskId) throw new Error("No taskId returned");

  const queryUrl = config.queryUrl || "https://www.runninghub.cn/openapi/v2/query";
  const pollResult = await pollTask(json.taskId, config.apiKey, queryUrl);

  // Download results
  ensureOutputDir();
  const files: string[] = [];
  if (pollResult.results) {
    for (let i = 0; i < pollResult.results.length; i++) {
      const resultUrl = pollResult.results[i].url;
      if (resultUrl) {
        const ext = ".mp4";
        const dest = resolve(OUTPUT_DIR, `vid_${json.taskId}_${i}${ext}`);
        await downloadFile(resultUrl, dest);
        files.push(dest);
      }
    }
  }

  return {
    files,
    cost: pollResult.cost ?? "?",
    duration: pollResult.duration ?? 0,
    taskId: json.taskId,
  };
}
