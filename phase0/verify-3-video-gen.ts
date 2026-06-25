/**
 * Phase 0 — 链路3: RunningHub 图生视频 + 轮询 + 本地下载验证
 *
 * 读取 panel-0.png，转为 Base64 Data URI，
 * 提交 RunningHub image-to-video 任务，轮询直到 SUCCESS/FAILED，
 * 下载 mp4 到本地。
 *
 * 运行: npx tsx phase0/verify-3-video-gen.ts
 */

import "dotenv/config";
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  createWriteStream,
  statSync,
} from "node:fs";
import { resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

// ---------------------------------------------------------------------------
// 配置
// ---------------------------------------------------------------------------

const RUNNINGHUB_API_KEY = process.env.RUNNINGHUB_API_KEY ?? "";

const OUTPUT_DIR = resolve(import.meta.dirname, "output");
const PANEL_FILE = resolve(OUTPUT_DIR, "panel-0.png");
const SCRIPT_FILE = resolve(OUTPUT_DIR, "script.json");
const OUTPUT_FILE = resolve(OUTPUT_DIR, "clip-v1.mp4");
const TASK_LOG_FILE = resolve(OUTPUT_DIR, "video-task-log.json");

const POLL_INTERVAL_MS = 5_000; // 5 秒轮询间隔
const MAX_POLL_ATTEMPTS = 120; // 最长等待 10 分钟

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------

interface ScriptScene {
  order: number;
  title: string;
  motionPrompt?: string;
  visualDescription: string;
}

interface ScriptOutput {
  title: string;
  aspectRatio: string;
  resolution: string;
  scenes: ScriptScene[];
}

interface SubmitResponse {
  taskId?: string;
  error?: string;
  message?: string;
}

interface QueryResponse {
  status?: "QUEUED" | "RUNNING" | "SUCCESS" | "FAILED";
  results?: { url?: string; outputType?: string }[];
  errorMessage?: string;
  failedReason?: unknown;
}

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------

/** 将本地文件读为 Base64 Data URI */
function fileToDataUri(filePath: string, mimeType = "image/png"): string {
  const buffer = readFileSync(filePath);
  const b64 = buffer.toString("base64");
  return `data:${mimeType};base64,${b64}`;
}

/** 下载远程文件到本地 */
async function downloadFile(url: string, dest: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`下载失败 (${response.status})`);
  }
  await pipeline(Readable.fromWeb(response.body as any), createWriteStream(dest));
}

/** 等待指定毫秒 */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------

async function main() {
  // 检查 API Key
  if (!RUNNINGHUB_API_KEY || RUNNINGHUB_API_KEY === "your_runninghub_key") {
    console.error("❌ 请在 .env 中设置 RUNNINGHUB_API_KEY");
    process.exit(1);
  }

  console.log("═══════════════════════════════════════════");
  console.log("  Phase 0 · 链路3: 图生视频验证");
  console.log("═══════════════════════════════════════════");
  console.log("");

  // 确保输出目录存在
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Step 1: 检查前置文件
  console.log("▶ 检查前置文件...");

  if (!existsSync(PANEL_FILE)) {
    console.error(`❌ 图片文件不存在: ${PANEL_FILE}`);
    console.error("   请先运行: npm run verify:image");
    process.exit(1);
  }

  const panelStat = statSync(PANEL_FILE);
  console.log(`  ✓ panel-0.png (${(panelStat.size / 1024).toFixed(1)} KB)`);

  // 读取脚本获取 motionPrompt 和 aspectRatio
  let motionPrompt = "smooth camera movement, cinematic quality";
  let aspectRatio = "16:9";
  let resolution = "720p";

  if (existsSync(SCRIPT_FILE)) {
    const script: ScriptOutput = JSON.parse(readFileSync(SCRIPT_FILE, "utf-8"));
    const scene = script.scenes[0];
    if (scene?.motionPrompt) {
      motionPrompt = scene.motionPrompt;
      console.log(`  ✓ motionPrompt: ${motionPrompt.slice(0, 80)}...`);
    }
    aspectRatio = script.aspectRatio ?? "16:9";
    resolution = script.resolution ?? "720p";
  } else {
    console.log("  ⚠ script.json 不存在，使用默认 motionPrompt");
  }

  // Step 2: 准备图片 (Base64 Data URI)
  console.log("");
  console.log("▶ 准备图片数据 (Base64 Data URI)...");

  const dataUri = fileToDataUri(PANEL_FILE);
  console.log(`  ✓ Base64 长度: ${(dataUri.length / 1024).toFixed(1)} KB`);

  // Step 3: 提交图生视频任务
  console.log("");
  console.log("▶ 提交图生视频任务...");
  console.log(`  prompt: ${motionPrompt.slice(0, 80)}...`);
  console.log(`  aspectRatio: ${aspectRatio}  ·  duration: 8s  ·  resolution: ${resolution}`);
  console.log(`  imageUrls: 1 张 (Base64)`);

  const submitStartTime = Date.now();

  const submitResponse = await fetch(
    "https://www.runninghub.cn/openapi/v2/rhart-video-v3.1-fast/image-to-video",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RUNNINGHUB_API_KEY}`,
      },
      body: JSON.stringify({
        prompt: motionPrompt,
        aspectRatio,
        imageUrls: [dataUri],
        duration: "8",
        resolution,
      }),
    },
  );

  if (!submitResponse.ok) {
    const body = await submitResponse.text();
    console.error(`❌ 提交失败 (${submitResponse.status}): ${body}`);
    process.exit(1);
  }

  const submitResult: SubmitResponse = await submitResponse.json();

  if (!submitResult.taskId) {
    console.error("❌ 提交返回中未找到 taskId:");
    console.error(JSON.stringify(submitResult, null, 2));
    process.exit(1);
  }

  const taskId = submitResult.taskId;
  console.log(`  ✓ 任务已提交`);
  console.log(`  taskId: ${taskId}`);

  // 保存任务信息
  writeFileSync(
    TASK_LOG_FILE,
    JSON.stringify(
      {
        taskId,
        submittedAt: new Date().toISOString(),
        prompt: motionPrompt,
        aspectRatio,
        resolution,
      },
      null,
      2,
    ),
    "utf-8",
  );

  // Step 4: 轮询任务状态
  console.log("");
  console.log("▶ 轮询任务状态...");

  let finalResult: QueryResponse | null = null;

  for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt++) {
    await sleep(POLL_INTERVAL_MS);

    const queryResponse = await fetch("https://www.runninghub.cn/openapi/v2/query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RUNNINGHUB_API_KEY}`,
      },
      body: JSON.stringify({ taskId }),
    });

    if (!queryResponse.ok) {
      console.log(`  ⚠ 查询失败 (${queryResponse.status})，重试中...`);
      continue;
    }

    const result: QueryResponse = await queryResponse.json();
    const elapsed = Math.round((Date.now() - submitStartTime) / 1000);

    const icon = { QUEUED: "⏳", RUNNING: "🔄", SUCCESS: "✅", FAILED: "❌" }[
      result.status ?? "QUEUED"
    ];

    console.log(`  ${icon} [${elapsed}s] #${attempt}  ${result.status}`);

    if (result.status === "SUCCESS") {
      finalResult = result;
      break;
    }

    if (result.status === "FAILED") {
      console.error(`  ❌ 任务失败:`);
      console.error(`     ${result.errorMessage ?? JSON.stringify(result.failedReason)}`);
      process.exit(1);
    }
  }

  if (!finalResult) {
    console.error(`❌ 轮询超时（等待 ${(MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS) / 1000}s）`);
    console.error(`   任务可能仍在运行，taskId: ${taskId}`);
    console.error(`   可稍后手动查询状态。`);
    process.exit(1);
  }

  // Step 5: 下载视频
  console.log("");
  console.log("▶ 正在下载视频...");

  // 优先找 mp4
  const mp4Result = finalResult.results?.find((r) => r.outputType === "mp4" || r.url?.endsWith(".mp4"));
  const videoUrl = mp4Result?.url ?? finalResult.results?.[0]?.url;

  if (!videoUrl) {
    console.error("❌ 结果中未找到视频 URL");
    console.error(JSON.stringify(finalResult, null, 2));
    process.exit(1);
  }

  await downloadFile(videoUrl, OUTPUT_FILE);

  const clipStat = statSync(OUTPUT_FILE);
  const totalElapsed = Math.round((Date.now() - submitStartTime) / 1000);

  console.log(`  ✓ 已保存到: ${OUTPUT_FILE} (${(clipStat.size / 1024 / 1024).toFixed(1)} MB)`);

  // Step 6: 更新任务日志
  writeFileSync(
    TASK_LOG_FILE,
    JSON.stringify(
      {
        taskId,
        submittedAt: new Date(submitStartTime).toISOString(),
        completedAt: new Date().toISOString(),
        totalElapsedSeconds: totalElapsed,
        prompt: motionPrompt,
        aspectRatio,
        resolution,
        videoUrl,
        localPath: OUTPUT_FILE,
        fileSizeBytes: clipStat.size,
      },
      null,
      2,
    ),
    "utf-8",
  );

  console.log("");
  console.log("───────────────────────────────────────────");
  console.log(`  taskId: ${taskId}`);
  console.log(`  总耗时: ${totalElapsed}s`);
  console.log(`  输出文件: ${OUTPUT_FILE}`);
  console.log(`  文件大小: ${(clipStat.size / 1024 / 1024).toFixed(1)} MB`);
  console.log("───────────────────────────────────────────");
  console.log("");
  console.log("✅ 链路3 验证通过！三条链路全部验证通过 🎉");
}

main().catch((err) => {
  console.error("❌ 未预期的错误:", err);
  process.exit(1);
});
