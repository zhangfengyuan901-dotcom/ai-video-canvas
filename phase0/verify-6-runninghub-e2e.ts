// =========================================================================
// verify-6-runninghub-e2e.ts
// =========================================================================
// RunningHub AI App 端到端烟雾测试
//
// 用本地 3 张 panel 图片完成完整闭环：
//   上传 → AI App 提交 → 轮询 → 下载 mp4 → 文件验证
//
// 用法：
//   # 先配置 .env 或环境变量
//   npx tsx phase0/verify-6-runninghub-e2e.ts
//
// 环境变量：
//   RH_E2E_SMOKE=1              启用真实端到端测试（默认 dry-run）
//   RH_E2E_PANEL_DIR             图片目录（默认 phase0/output）
//   RH_E2E_PROMPT                自定义 prompt（可选）
//   RH_E2E_OUTPUT_DIR            下载目录（默认 phase0/output/e2e）
// =========================================================================

import { getEffectiveApiConfig } from "../apps/server/src/services/settings/ApiConfigService.js";
import {
  uploadMultipleBinaries,
  submitVideoTask,
  queryTaskStatus,
  downloadVideo,
} from "../apps/server/src/services/api/RunningHubVideoClient.js";

import { existsSync, mkdirSync, writeFileSync, statSync } from "node:fs";
import { resolve, basename } from "node:path";
import { deflateSync } from "node:zlib";

const RH_E2E_SMOKE = process.env.RH_E2E_SMOKE === "1";
const PANEL_DIR = resolve(process.env.RH_E2E_PANEL_DIR || resolve(import.meta.dirname, "output"));
const OUTPUT_DIR = resolve(process.env.RH_E2E_OUTPUT_DIR || resolve(PANEL_DIR, "e2e"));

const POLL_INTERVAL_MS = 5_000;
const MAX_POLL_ATTEMPTS = 120; // ~10 分钟

// ---- 辅助日志 ------------------------------------------------------------

function info(label: string, msg: string): void {
  console.log(`  [e2e] ${label} ${msg}`);
}
function ok(label: string, msg: string): void {
  console.log(`  [e2e] \x1b[32m✓\x1b[0m ${label} ${msg}`);
}
function warn(label: string, msg: string): void {
  console.log(`  [e2e] \x1b[33m⚠\x1b[0m ${label} ${msg}`);
}
function fail(label: string, msg: string): void {
  console.log(`  [e2e] \x1b[31m✗\x1b[0m ${label} ${msg}`);
}
function divider(): void {
  console.log(`  [e2e] ----------------------------------------`);
}

// ---- PNG 生成 -----------------------------------------------------------
// 用纯 Node.js 生成最小有效 PNG（1x1 像素，实色），避免外部依赖

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const t = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crcInput = Buffer.concat([t, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcInput));
  return Buffer.concat([len, t, data, crc]);
}

function makeTestPng(r: number, g: number, b: number): Buffer {
  // 1x1 pixel, color type 2 (RGB), bit depth 8
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0);  // width
  ihdr.writeUInt32BE(1, 4);  // height
  ihdr[8] = 8;               // bit depth
  ihdr[9] = 2;               // color type RGB
  ihdr[10] = 0;              // compression
  ihdr[11] = 0;              // filter
  ihdr[12] = 0;              // interlace

  const rawScanline = Buffer.from([0, r, g, b]); // filter byte 0 + RGB
  const compressed = deflateSync(rawScanline);

  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", compressed),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- 步骤 0: 检查 API Key ------------------------------------------------

function checkPrerequisites(): boolean {
  const config = getEffectiveApiConfig().runninghub;
  const hasKey = !!config.apiKey && config.apiKey !== "your_runninghub_key";

  if (hasKey) {
    const masked =
      config.apiKey.length <= 8
        ? "****"
        : `${config.apiKey.slice(0, 4)}****${config.apiKey.slice(-4)}`;
    ok("API Key", `已配置 (${masked})`);
  } else {
    fail("API Key", `未配置，请在 .env 中设置 RUNNINGHUB_API_KEY`);
  }

  if (!RH_E2E_SMOKE) {
    warn("e2e smoke", `跳过（设置 RH_E2E_SMOKE=1 启用端到端测试）`);
  }

  return hasKey;
}

// ---- 步骤 1: 准备 3 张图片 -----------------------------------------------

function preparePanelImages(): string[] {
  const paths: string[] = [];
  const panelNames = ["panel-0.png", "panel-1.png", "panel-2.png"];
  const panelDir = PANEL_DIR;

  if (!existsSync(panelDir)) {
    mkdirSync(panelDir, { recursive: true });
  }

  const colors: [number, number, number][] = [
    [70, 130, 180],  // 蓝色
    [60, 179, 113],  // 绿色
    [220, 20, 60],   // 红色
  ];

  for (let i = 0; i < 3; i++) {
    const existingPath = resolve(panelDir, panelNames[i]);
    if (existsSync(existingPath)) {
      const stat = statSync(existingPath);
      if (stat.size > 0) {
        paths.push(existingPath);
        info("panel", `使用已有图片 ${i + 1}: ${basename(existingPath)} (${stat.size} bytes)`);
        continue;
      }
    }

    // 生成测试图片
    const png = makeTestPng(colors[i][0], colors[i][1], colors[i][2]);
    writeFileSync(existingPath, png);
    paths.push(existingPath);
    info("panel", `生成测试图片 ${i + 1}: ${basename(existingPath)} (${png.length} bytes)`);
  }

  return paths;
}

// ---- 步骤 2: 上传图片到 RunningHub ---------------------------------------

async function uploadPanels(panelPaths: string[]): Promise<string[]> {
  info("upload", `上传 ${panelPaths.length} 张图片...`);

  try {
    const imageUrls = await uploadMultipleBinaries(panelPaths);
    for (let i = 0; i < imageUrls.length; i++) {
      // 只打尾部，不打完整 URL（避免日志过长）
      const tail = imageUrls[i].slice(-40);
      ok("upload", `图片 ${i + 1}: ...${tail}`);
    }
    return imageUrls;
  } catch (err: any) {
    fail("upload", `上传失败: ${err.message}`);
    throw err;
  }
}

// ---- 步骤 3: 提交 AI App 任务 --------------------------------------------

async function submitJob(
  prompt: string,
  imageUrls: string[],
  aspectRatio: string,
  resolution: string,
  duration: string,
): Promise<string> {
  info("submit", "提交 AI App 任务...");

  const safePrompt = prompt.length > 50 ? `${prompt.slice(0, 50)}...` : prompt;
  info("submit", `prompt="${safePrompt}", ratio=${aspectRatio}, res=${resolution}, dur=${duration}s`);

  try {
    const taskId = await submitVideoTask(prompt, imageUrls, aspectRatio, resolution, duration);
    ok("submit", `taskId=${taskId}`);
    return taskId;
  } catch (err: any) {
    fail("submit", `提交失败: ${err.message}`);
    throw err;
  }
}

// ---- 步骤 4: 轮询任务状态 ------------------------------------------------

async function pollTask(taskId: string): Promise<{ status: string; results?: { url?: string; outputType?: string }[] }> {
  info("poll", `开始轮询 taskId=${taskId}...`);

  for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt++) {
    const result = await queryTaskStatus(taskId);

    info("poll", `[${attempt}/${MAX_POLL_ATTEMPTS}] status=${result.status}`);

    if (result.status === "SUCCESS") {
      ok("poll", `任务成功 (${attempt} 次轮询)`);

      if (result.results && result.results.length > 0) {
        for (const r of result.results) {
          info("result", `  outputType=${r.outputType}, url=...${r.url?.slice(-20) ?? "N/A"}`);
        }
      }
      return result as any;
    }

    if (result.status === "FAILED") {
      fail("poll", `任务失败: ${result.errorMessage || JSON.stringify(result.failedReason) || "未知错误"}`);
      throw new Error(`Task failed: ${result.errorMessage}`);
    }

    if (attempt < MAX_POLL_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
  }

  throw new Error(`轮询超时 (${MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS / 1000} 秒)`);
}

// ---- 步骤 5: 下载 MP4 ----------------------------------------------------

async function downloadClip(remoteUrl: string, outputPath: string): Promise<string> {
  info("download", `下载视频到 ${basename(outputPath)}...`);

  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  try {
    await downloadVideo(remoteUrl, outputPath);
    const stat = statSync(outputPath);
    ok("download", `下载完成: ${stat.size} bytes`);

    if (stat.size < 100) {
      fail("download", `文件太小 (${stat.size} bytes)，可能不是有效视频`);
      throw new Error(`Downloaded file too small: ${stat.size} bytes`);
    }

    return outputPath;
  } catch (err: any) {
    fail("download", `下载失败: ${err.message}`);
    throw err;
  }
}

// ---- main ----------------------------------------------------------------

async function main() {
  console.log("");
  console.log("  [e2e] === RunningHub AI App 端到端烟雾测试 ===");
  console.log("");

  // 步骤 0: 前置检查
  divider();
  const keyOk = checkPrerequisites();
  if (!keyOk || !RH_E2E_SMOKE) {
    divider();
    if (!RH_E2E_SMOKE) {
      ok("dry-run", `设置 RH_E2E_SMOKE=1 启用真实端到端测试`);
      console.log("");
      process.exit(0);
    }
    process.exit(1);
  }

  // 步骤 1: 准备图片
  divider();
  info("step 1/5", "准备 panel 图片...");
  const panelPaths = preparePanelImages();
  if (panelPaths.length !== 3) {
    fail("panel", `需要 3 张图片，当前 ${panelPaths.length} 张`);
    process.exit(1);
  }
  ok("panel", `已就绪 ${panelPaths.length} 张图片`);
  for (const p of panelPaths) {
    info("  file", `${basename(p)} (${statSync(p).size} bytes)`);
  }

  // 步骤 2: 上传图片
  divider();
  info("step 2/5", "上传图片到 RunningHub...");
  const imageUrls = await uploadPanels(panelPaths);

  // 步骤 3: 提交任务
  divider();
  info("step 3/5", "提交 AI App 任务...");
  const prompt =
    process.env.RH_E2E_PROMPT ||
    "镜头1：蓝色背景下的产品缓缓旋转展示，光影柔和；" +
    "镜头2：绿色户外场景，人物自然行走；" +
    "镜头3：红色舞台聚光灯效果，主体居中特写。";
  const taskId = await submitJob(prompt, imageUrls, "16:9", "720p", "8");

  // 步骤 4: 轮询
  divider();
  info("step 4/5", "轮询任务状态...");
  const taskResult = await pollTask(taskId);

  // 取第一个 mp4 结果
  let videoUrl: string | undefined;
  if (taskResult.results) {
    const mp4 = taskResult.results.find((r) => r.outputType === "mp4");
    videoUrl = mp4?.url ?? taskResult.results[0]?.url;
  }

  if (!videoUrl) {
    fail("video", `未找到视频结果: ${JSON.stringify(taskResult.results)}`);
    process.exit(1);
  }
  ok("video", `找到视频结果: outputType=${taskResult.results?.find((r) => r.url === videoUrl)?.outputType ?? "unknown"}`);

  // 步骤 5: 下载
  divider();
  info("step 5/5", "下载 MP4 到本地...");
  const outputPath = resolve(OUTPUT_DIR, `e2e-clip-${taskId.slice(0, 8)}.mp4`);
  await downloadClip(videoUrl, outputPath);

  divider();
  console.log("");
  console.log("  [e2e] \x1b[32m✓ 端到端烟雾测试通过\x1b[0m");
  console.log(`  [e2e]   输出文件: ${outputPath}`);
  console.log("");
  process.exit(0);
}

main().catch((err) => {
  console.error(`  [e2e] \x1b[31mFatal:\x1b[0m ${err.message}`);
  process.exit(1);
});
