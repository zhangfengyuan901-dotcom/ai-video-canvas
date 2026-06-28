// =========================================================================
// ApiConfigService — API 配置存储与读取服务
// 本地存储到 local-data/config/api-config.json，支持 .env 回退
// =========================================================================

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// ---- 类型 ---------------------------------------------------------------

export interface StoredApiConfig {
  chat?: {
    enabled?: boolean;
    baseUrl?: string;
    apiKey?: string;
    model?: string;
  };
  packy?: {
    enabled?: boolean;
    baseUrl?: string;
    apiKey?: string;
    imageModel?: string;
  };
  runninghub?: {
    enabled?: boolean;
    apiKey?: string;
    submitUrl?: string;
    queryUrl?: string;
    uploadUrl?: string;
  };
}

export interface ApiConfigPatch {
  chat?: {
    enabled?: boolean;
    baseUrl?: string;
    model?: string;
    apiKey?: string;
    clearApiKey?: boolean;
  };
  packy?: {
    enabled?: boolean;
    baseUrl?: string;
    imageModel?: string;
    apiKey?: string;
    clearApiKey?: boolean;
  };
  runninghub?: {
    enabled?: boolean;
    apiKey?: string;
    clearApiKey?: boolean;
    submitUrl?: string;
    queryUrl?: string;
    uploadUrl?: string;
  };
}

export interface ApiConfigStatus {
  chat: {
    configured: boolean;
    source: "stored" | "env" | "missing";
    maskedKey: string | null;
    baseUrl: string;
    model: string;
  };
  packy: {
    configured: boolean;
    source: "stored" | "env" | "missing";
    maskedKey: string | null;
    baseUrl: string;
    imageModel: string;
  };
  runninghub: {
    configured: boolean;
    source: "stored" | "env" | "missing";
    maskedKey: string | null;
    submitUrl: string;
    queryUrl: string;
    uploadUrl: string;
  };
}

// ---- 默认值 -------------------------------------------------------------

const DEFAULT_CHAT_BASE_URL = "https://www.packyapi.com/v1";
const DEFAULT_CHAT_MODEL = "gpt-5.4";
const DEFAULT_PACKY_BASE_URL = "https://www.packyapi.com/v1";
const DEFAULT_PACKY_IMAGE_MODEL = "gpt-image-2";
const DEFAULT_RUNNINGHUB_AI_APP_ID = "2037453629342355457";
const DEFAULT_RUNNINGHUB_SUBMIT_URL =
  `https://www.runninghub.cn/openapi/v2/run/ai-app/${DEFAULT_RUNNINGHUB_AI_APP_ID}`;
const DEFAULT_RUNNINGHUB_QUERY_URL = "https://www.runninghub.cn/openapi/v2/query";
const DEFAULT_RUNNINGHUB_UPLOAD_URL = "https://www.runninghub.cn/openapi/v2/media/upload/binary";

// ---- 路径 ---------------------------------------------------------------

const CONFIG_DIR = resolve(import.meta.dirname, "../../../../../local-data/config");
const CONFIG_PATH = resolve(CONFIG_DIR, "api-config.json");

function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

// ---- 读写本地配置 -------------------------------------------------------

function readStoredConfig(): StoredApiConfig {
  if (!existsSync(CONFIG_PATH)) return {};
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf-8")) as StoredApiConfig;
  } catch {
    return {};
  }
}

function saveStoredConfig(config: StoredApiConfig): void {
  ensureConfigDir();
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
}

// ---- 掩码 ---------------------------------------------------------------

function maskSecret(value: string | undefined): string | null {
  if (!value) return null;
  if (value.length <= 8) return "****";
  return `${value.slice(0, 4)}****${value.slice(-4)}`;
}

// ---- 运行时有效配置（合并 stored + env + 默认值）-------------------------

export function getEffectiveApiConfig(): {
  chat: { enabled: boolean; baseUrl: string; apiKey: string; model: string };
  packy: { enabled: boolean; baseUrl: string; apiKey: string; imageModel: string };
  runninghub: { enabled: boolean; apiKey: string; submitUrl: string; queryUrl: string; uploadUrl: string };
} {
  const stored = readStoredConfig();

  const chatApiKey = stored.chat?.apiKey || process.env.PACKY_CHAT_API_KEY || "";
  const packyApiKey = stored.packy?.apiKey || process.env.PACKY_SORA_API_KEY || "";
  const rhApiKey = stored.runninghub?.apiKey || process.env.RUNNINGHUB_API_KEY || "";

  return {
    chat: {
      enabled: stored.chat?.enabled ?? true,
      baseUrl: stored.chat?.baseUrl || process.env.PACKY_BASE_URL || DEFAULT_CHAT_BASE_URL,
      apiKey: chatApiKey,
      model: stored.chat?.model || process.env.PACKY_CHAT_MODEL || DEFAULT_CHAT_MODEL,
    },
    packy: {
      enabled: stored.packy?.enabled ?? true,
      baseUrl: stored.packy?.baseUrl || process.env.PACKY_BASE_URL || DEFAULT_PACKY_BASE_URL,
      apiKey: packyApiKey,
      imageModel: stored.packy?.imageModel || process.env.PACKY_IMAGE_MODEL || DEFAULT_PACKY_IMAGE_MODEL,
    },
    runninghub: {
      enabled: stored.runninghub?.enabled ?? true,
      apiKey: rhApiKey,
      submitUrl:
        stored.runninghub?.submitUrl ||
        process.env.RUNNINGHUB_SUBMIT_URL ||
        DEFAULT_RUNNINGHUB_SUBMIT_URL,
      queryUrl:
        stored.runninghub?.queryUrl ||
        process.env.RUNNINGHUB_QUERY_URL ||
        DEFAULT_RUNNINGHUB_QUERY_URL,
      uploadUrl:
        stored.runninghub?.uploadUrl ||
        process.env.RUNNINGHUB_UPLOAD_URL ||
        DEFAULT_RUNNINGHUB_UPLOAD_URL,
    },
  };
}

// ---- 安全状态（给前端用，不暴露真实 key）----------------------------------

export function getSafeApiConfig(): ApiConfigStatus {
  const stored = readStoredConfig();

  // Chat
  const chatStoredKey = stored.chat?.apiKey;
  const chatEnvKey = process.env.PACKY_CHAT_API_KEY || undefined;
  const chatKey = chatStoredKey || chatEnvKey;

  // Packy
  const storedKey = stored.packy?.apiKey;
  const envKey = process.env.PACKY_SORA_API_KEY || undefined;
  const packyKey = storedKey || envKey;

  // RunningHub
  const rhStoredKey = stored.runninghub?.apiKey;
  const rhEnvKey = process.env.RUNNINGHUB_API_KEY || undefined;
  const rhKey = rhStoredKey || rhEnvKey;

  return {
    chat: {
      configured: !!chatKey,
      source: chatStoredKey ? "stored" : chatEnvKey ? "env" : "missing",
      maskedKey: maskSecret(chatKey),
      baseUrl: stored.chat?.baseUrl || process.env.PACKY_BASE_URL || DEFAULT_CHAT_BASE_URL,
      model: stored.chat?.model || process.env.PACKY_CHAT_MODEL || DEFAULT_CHAT_MODEL,
    },
    packy: {
      configured: !!packyKey,
      source: storedKey ? "stored" : envKey ? "env" : "missing",
      maskedKey: maskSecret(packyKey),
      baseUrl: stored.packy?.baseUrl || process.env.PACKY_BASE_URL || DEFAULT_PACKY_BASE_URL,
      imageModel: stored.packy?.imageModel || process.env.PACKY_IMAGE_MODEL || DEFAULT_PACKY_IMAGE_MODEL,
    },
    runninghub: {
      configured: !!rhKey,
      source: rhStoredKey ? "stored" : rhEnvKey ? "env" : "missing",
      maskedKey: maskSecret(rhKey),
      submitUrl:
        stored.runninghub?.submitUrl ||
        process.env.RUNNINGHUB_SUBMIT_URL ||
        DEFAULT_RUNNINGHUB_SUBMIT_URL,
      queryUrl:
        stored.runninghub?.queryUrl ||
        process.env.RUNNINGHUB_QUERY_URL ||
        DEFAULT_RUNNINGHUB_QUERY_URL,
      uploadUrl:
        stored.runninghub?.uploadUrl ||
        process.env.RUNNINGHUB_UPLOAD_URL ||
        DEFAULT_RUNNINGHUB_UPLOAD_URL,
    },
  };
}

// ---- 保存配置 patch -----------------------------------------------------

export function saveApiConfigPatch(patch: ApiConfigPatch): ApiConfigStatus {
  const current = readStoredConfig();

  // Chat
  const chat = { ...(current.chat || {}) };
  if (patch.chat) {
    if (patch.chat.enabled !== undefined) chat.enabled = patch.chat.enabled;
    if (patch.chat.baseUrl !== undefined) chat.baseUrl = patch.chat.baseUrl.trim();
    if (patch.chat.model !== undefined) chat.model = patch.chat.model;
    if (patch.chat.apiKey) chat.apiKey = patch.chat.apiKey;
    if (patch.chat.clearApiKey) delete chat.apiKey;
  }

  // Packy
  const packy = { ...(current.packy || {}) };
  if (patch.packy) {
    if (patch.packy.enabled !== undefined) packy.enabled = patch.packy.enabled;
    if (patch.packy.baseUrl !== undefined) packy.baseUrl = patch.packy.baseUrl.trim();
    if (patch.packy.imageModel !== undefined) packy.imageModel = patch.packy.imageModel;
    if (patch.packy.apiKey) packy.apiKey = patch.packy.apiKey;
    if (patch.packy.clearApiKey) delete packy.apiKey;
  }

  // RunningHub
  const runninghub = { ...(current.runninghub || {}) };
  if (patch.runninghub) {
    if (patch.runninghub.enabled !== undefined) runninghub.enabled = patch.runninghub.enabled;
    if (patch.runninghub.apiKey) runninghub.apiKey = patch.runninghub.apiKey;
    if (patch.runninghub.clearApiKey) delete runninghub.apiKey;
    if (patch.runninghub.submitUrl !== undefined) runninghub.submitUrl = patch.runninghub.submitUrl.trim();
    if (patch.runninghub.queryUrl !== undefined) runninghub.queryUrl = patch.runninghub.queryUrl.trim();
    if (patch.runninghub.uploadUrl !== undefined) runninghub.uploadUrl = patch.runninghub.uploadUrl.trim();
  }

  const updated: StoredApiConfig = { chat, packy, runninghub };
  saveStoredConfig(updated);

  return getSafeApiConfig();
}

// ---- 配置自检（轻量，不调用真实接口）--------------------------------------

export function checkApiConfig(): {
  chat: { configured: boolean; message: string };
  packy: { configured: boolean; message: string };
  runninghub: { configured: boolean; message: string };
} {
  const effective = getEffectiveApiConfig();

  const chatOk = !!effective.chat.apiKey && !!effective.chat.baseUrl && !!effective.chat.model;
  const packyOk = !!effective.packy.apiKey && !!effective.packy.baseUrl && !!effective.packy.imageModel;
  const rhOk = !!effective.runninghub.apiKey && !!effective.runninghub.submitUrl
    && !!effective.runninghub.queryUrl && !!effective.runninghub.uploadUrl;

  return {
    chat: {
      configured: chatOk,
      message: chatOk
        ? "Chat LLM API 配置正常"
        : "Chat API Key 或 URL 未配置",
    },
    packy: {
      configured: packyOk,
      message: packyOk
        ? "Packy 图片生成 API 配置正常"
        : "Packy API Key 或 URL 未配置",
    },
    runninghub: {
      configured: rhOk,
      message: rhOk
        ? "RunningHub 视频生成 API 配置正常"
        : "RunningHub API Key 或 URL 未配置",
    },
  };
}
