/**
 * Phase 0 — 链路2: gpt-image-2 图片生成 + 本地下载验证
 *
 * 读取 script.json 中第一个镜头的 visualDescription，
 * 调用 Packy gpt-image-2 生成一张 16:9 图片，下载到本地。
 *
 * 运行: npx tsx phase0/verify-2-image-gen.ts
 */

import "dotenv/config";
import { readFileSync, writeFileSync, mkdirSync, existsSync, createWriteStream } from "node:fs";
import { resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

// ---------------------------------------------------------------------------
// 配置
// ---------------------------------------------------------------------------

const BASE_URL = process.env.PACKY_BASE_URL ?? "https://www.packyapi.com/v1";
const API_KEY = process.env.PACKY_SORA_API_KEY ?? ""; // 必须使用 Sora 分组令牌
const MODEL = process.env.PACKY_IMAGE_MODEL ?? "gpt-image-2";

const OUTPUT_DIR = resolve(import.meta.dirname, "output");
const SCRIPT_FILE = resolve(OUTPUT_DIR, "script.json");
const OUTPUT_FILE = resolve(OUTPUT_DIR, "panel-0.png");

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------

interface ScriptScene {
  order: number;
  title: string;
  visualDescription: string;
  motionPrompt?: string;
}

interface ScriptOutput {
  title: string;
  aspectRatio: string;
  resolution: string;
  styleBible: Record<string, string>;
  scenes: ScriptScene[];
}

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------

async function downloadFile(url: string, dest: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`下载失败 (${response.status})`);
  }
  await pipeline(Readable.fromWeb(response.body as any), createWriteStream(dest));
  console.log(`  ✓ 已下载到: ${dest}`);
}

function getImageSize(aspectRatio: string): string {
  return aspectRatio === "9:16" ? "864x1536" : "1536x864";
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------

async function main() {
  // 检查 API Key
  if (!API_KEY || API_KEY === "your_sora_group_key") {
    console.error("❌ 请在 .env 中设置 PACKY_SORA_API_KEY（Sora 分组令牌，不是 Chat 分组）");
    process.exit(1);
  }

  console.log("═══════════════════════════════════════════");
  console.log("  Phase 0 · 链路2: 图片生成验证");
  console.log("═══════════════════════════════════════════");
  console.log(`  Model: ${MODEL}`);
  console.log(`  API:   ${BASE_URL}/images/generations`);
  console.log("");

  // 确保输出目录存在
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Step 1: 读取脚本中的第一个镜头
  console.log("▶ 读取脚本 JSON...");

  if (!existsSync(SCRIPT_FILE)) {
    console.error(`❌ 脚本文件不存在: ${SCRIPT_FILE}`);
    console.error("   请先运行: npm run verify:script");
    process.exit(1);
  }

  const script: ScriptOutput = JSON.parse(readFileSync(SCRIPT_FILE, "utf-8"));
  const scene = script.scenes[0];

  if (!scene) {
    console.error("❌ 脚本中没有镜头数据");
    process.exit(1);
  }

  console.log(`  ✓ 镜头: ${scene.title} (order ${scene.order})`);
  console.log(`    visualDescription: ${scene.visualDescription.slice(0, 80)}...`);

  // Step 2: 调用 gpt-image-2
  const size = getImageSize(script.aspectRatio ?? "16:9");

  console.log("");
  console.log("▶ 正在调用 gpt-image-2 生成图片...");
  console.log(`  size: ${size}  ·  quality: medium  ·  format: png`);

  const startTime = Date.now();

  const response = await fetch(`${BASE_URL}/images/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      prompt: scene.visualDescription,
      size,
      quality: "medium",
      output_format: "png",
      response_format: "url",
      n: 1,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`❌ API 调用失败 (${response.status}): ${body}`);
    process.exit(1);
  }

  const json = (await response.json()) as {
    data?: { url?: string; revised_prompt?: string }[];
  };

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`  ✓ 图片生成成功 (${elapsed}s)`);

  const imageUrl = json.data?.[0]?.url;
  const revisedPrompt = json.data?.[0]?.revised_prompt;

  if (!imageUrl) {
    console.error("❌ API 返回中未找到图片 URL");
    console.error(JSON.stringify(json, null, 2));
    process.exit(1);
  }

  if (revisedPrompt) {
    console.log(`  revised_prompt: ${revisedPrompt.slice(0, 80)}...`);
  }

  // Step 3: 下载图片到本地
  console.log("");
  console.log("▶ 正在下载图片到本地...");
  await downloadFile(imageUrl, OUTPUT_FILE);

  // Step 4: 写入 revised prompt 信息
  const infoFile = resolve(OUTPUT_DIR, "panel-0-info.json");
  writeFileSync(
    infoFile,
    JSON.stringify(
      {
        sceneTitle: scene.title,
        sceneOrder: scene.order,
        originalPrompt: scene.visualDescription,
        revisedPrompt: revisedPrompt ?? null,
        imageUrl,
        generatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
    "utf-8",
  );
  console.log(`  ✓ 附加信息已保存到: ${infoFile}`);

  console.log("");
  console.log("───────────────────────────────────────────");
  console.log(`  图片尺寸: ${size}`);
  console.log(`  输出文件: ${OUTPUT_FILE}`);
  console.log(`  耗时: ${elapsed}s`);
  console.log("───────────────────────────────────────────");
  console.log("");
  console.log("✅ 链路2 验证通过！");
}

main().catch((err) => {
  console.error("❌ 未预期的错误:", err);
  process.exit(1);
});
