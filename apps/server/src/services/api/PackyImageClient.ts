// =========================================================================
// PackyImageClient — 调用 gpt-image-2 生成并下载图片
// API 约束见 docs/packy-gpt-image-2.md
// =========================================================================

import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { getEffectiveApiConfig } from "../settings/ApiConfigService.js";

const BASE_URL = process.env.PACKY_BASE_URL ?? "https://www.packyapi.com/v1";

// ---- 图片尺寸映射 ------------------------------------------------------

function getSize(aspectRatio: "16:9" | "9:16"): string {
  return aspectRatio === "9:16" ? "864x1536" : "1536x864";
}

// ---- 结果类型 ----------------------------------------------------------

export interface GenerationResult {
  remoteUrl: string;
  revisedPrompt?: string;
}

// ---- 生成单张图片（URL 模式）-------------------------------------------

export async function generateImage(
  prompt: string,
  aspectRatio: "16:9" | "9:16" = "16:9",
): Promise<GenerationResult> {
  const config = getEffectiveApiConfig().packy;
  if (!config.apiKey || config.apiKey === "your_sora_group_key") {
    throw new Error("Packy Sora API Key 未配置，请先在 API 配置中设置");
  }

  const baseUrl = config.baseUrl || "https://www.packyapi.com/v1";
  const model = config.imageModel || "gpt-image-2";
  const size = getSize(aspectRatio);

  const response = await fetch(`${baseUrl}/images/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model,
      prompt,
      size,
      quality: "medium",
      output_format: "png",
      response_format: "url",
      n: 1,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`gpt-image-2 API call failed (${response.status}): ${body}`);
  }

  const json = (await response.json()) as {
    data?: { url?: string; revised_prompt?: string }[];
  };

  const remoteUrl = json.data?.[0]?.url;
  if (!remoteUrl) {
    throw new Error("gpt-image-2 returned no URL in response");
  }

  return {
    remoteUrl,
    revisedPrompt: json.data?.[0]?.revised_prompt,
  };
}

// ---- 从远程 URL 下载到本地 ---------------------------------------------

export async function downloadImage(remoteUrl: string, localPath: string): Promise<void> {
  const response = await fetch(remoteUrl);
  if (!response.ok || !response.body) {
    throw new Error(`Image download failed (${response.status})`);
  }
  await pipeline(Readable.fromWeb(response.body as any), createWriteStream(localPath));
}

// ---- 生成并下载（组合操作）----------------------------------------------

export async function generateAndDownload(
  prompt: string,
  localPath: string,
  aspectRatio: "16:9" | "9:16" = "16:9",
): Promise<GenerationResult> {
  const result = await generateImage(prompt, aspectRatio);
  await downloadImage(result.remoteUrl, localPath);
  return result;
}
