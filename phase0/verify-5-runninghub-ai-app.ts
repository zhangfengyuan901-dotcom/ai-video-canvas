// =========================================================================
// verify-5-runninghub-ai-app.ts
// =========================================================================
// 验证 RunningHub AI App 工作流集成
//
// 用法：
//   npx tsx phase0/verify-5-runninghub-ai-app.ts
//
// 默认仅检查配置和 nodeInfoList 构建，不发起真实调用。
// 设置 RUNNINGHUB_VERIFY_AI_APP=1 才会真正提交任务：
//   RUNNINGHUB_VERIFY_AI_APP=1 npx tsx phase0/verify-5-runninghub-ai-app.ts
//
// 环境变量：
//   RUNNINGHUB_VERIFY_AI_APP=1        启用真实提交
//   RUNNINGHUB_VERIFY_IMAGE_URLS=...  逗号分隔的图片 URL（默认用本地测试图片）
//   RUNNINGHUB_VERIFY_PROMPT=...      prompt 文本
// =========================================================================

import { getEffectiveApiConfig } from "../apps/server/src/services/settings/ApiConfigService.js";
import {
  buildRunningHubAiAppNodeInfoList,
  normalizeRunningHubDuration,
  normalizeRunningHubRatio,
  normalizeRunningHubResolution,
  submitVideoTask,
} from "../apps/server/src/services/api/RunningHubVideoClient.js";

const VERIFY_AI_APP = process.env.RUNNINGHUB_VERIFY_AI_APP === "1";

// ---- 辅助：彩色日志 -------------------------------------------------------

function info(label: string, msg: string): void {
  console.log(`  [verify] ${label} ${msg}`);
}

function ok(label: string, msg: string): void {
  console.log(`  [verify] ✓ ${label} ${msg}`);
}

function warn(label: string, msg: string): void {
  console.log(`  [verify] ⚠ ${label} ${msg}`);
}

function fail(label: string, msg: string): void {
  console.log(`  [verify] ✗ ${label} ${msg}`);
}

function divider(): void {
  console.log(`  [verify] ----------------------------------------`);
}

// ---- 检查 1: API Key 配置 -----------------------------------------------

function checkApiKey(): boolean {
  const config = getEffectiveApiConfig().runninghub;
  const hasKey = !!config.apiKey && config.apiKey !== "your_runninghub_key";

  if (hasKey) {
    const masked =
      config.apiKey.length <= 8
        ? "****"
        : `${config.apiKey.slice(0, 4)}****${config.apiKey.slice(-4)}`;
    ok("API Key", `已配置 (${masked})`);
  } else {
    fail("API Key", `未配置或使用默认占位值`);
  }

  return hasKey;
}

// ---- 检查 2: URL 配置 ----------------------------------------------------

function checkUrls(): boolean {
  const config = getEffectiveApiConfig().runninghub;
  let allOk = true;

  if (config.submitUrl.includes("/run/ai-app/2037453629342355457")) {
    ok("submitUrl", config.submitUrl);
  } else {
    fail("submitUrl", config.submitUrl);
    allOk = false;
  }

  if (config.queryUrl.includes("/query")) {
    ok("queryUrl", config.queryUrl);
  } else {
    fail("queryUrl", config.queryUrl);
    allOk = false;
  }

  if (config.uploadUrl.includes("/media/upload/binary")) {
    ok("uploadUrl", config.uploadUrl);
  } else {
    fail("uploadUrl", config.uploadUrl);
    allOk = false;
  }

  return allOk;
}

// ---- 检查 3: 参数归一化 ---------------------------------------------------

function checkNormalizeFunctions(): boolean {
  let allOk = true;

  const validDuration = normalizeRunningHubDuration("8");
  if (validDuration === "8") {
    ok("normalizeDuration(8)", `= ${validDuration}`);
  } else {
    fail("normalizeDuration(8)", `= ${validDuration}`);
    allOk = false;
  }

  const invalidDuration = normalizeRunningHubDuration("999");
  if (invalidDuration === "5") {
    ok("normalizeDuration(999)", `fallback to ${invalidDuration}`);
  } else {
    fail("normalizeDuration(999)", `= ${invalidDuration}`);
    allOk = false;
  }

  const validRatio = normalizeRunningHubRatio("16:9");
  if (validRatio === "16:9") {
    ok("normalizeRatio(16:9)", `= ${validRatio}`);
  } else {
    fail("normalizeRatio(16:9)", `= ${validRatio}`);
    allOk = false;
  }

  const invalidRatio = normalizeRunningHubRatio("invalid");
  if (invalidRatio === "adaptive") {
    ok("normalizeRatio(invalid)", `fallback to ${invalidRatio}`);
  } else {
    fail("normalizeRatio(invalid)", `= ${invalidRatio}`);
    allOk = false;
  }

  const validRes = normalizeRunningHubResolution("720p");
  if (validRes === "720p") {
    ok("normalizeResolution(720p)", `= ${validRes}`);
  } else {
    fail("normalizeResolution(720p)", `= ${validRes}`);
    allOk = false;
  }

  const invalidRes = normalizeRunningHubResolution("invalid");
  if (invalidRes === "720p") {
    ok("normalizeResolution(invalid)", `fallback to ${invalidRes}`);
  } else {
    fail("normalizeResolution(invalid)", `= ${invalidRes}`);
    allOk = false;
  }

  return allOk;
}

// ---- 检查 4: nodeInfoList 构建 -------------------------------------------

function checkNodeInfoList(): boolean {
  const imageUrls = [
    "https://example.com/image1.png",
    "https://example.com/image2.png",
    "https://example.com/image3.png",
  ];
  const prompt = "Test prompt for AI App verification";

  const nodeInfoList = buildRunningHubAiAppNodeInfoList({
    prompt,
    imageUrls,
    aspectRatio: "16:9",
    resolution: "720p",
    duration: "8",
    realPersonMode: true,
  });

  info("nodeInfoList.count", `${nodeInfoList.length}`);
  info("imageUrls input", `${imageUrls.length}`);

  // First image node (index 0) should map to nodeId=2
  const imageNode = nodeInfoList.find((n) => n.nodeId === "2" && n.fieldName === "image");
  if (imageNode && imageNode.fieldValue === imageUrls[0]) {
    ok("nodeId=2 (image1)", `gets imageUrls[0]`);
  } else {
    fail("nodeId=2 (image1)", `fieldValue=${imageNode?.fieldValue}`);
  }

  // With 3 images, node 2/7/8 get the URLs, node 9+ should be "None"
  const node9 = nodeInfoList.find((n) => n.nodeId === "9" && n.fieldName === "image");
  if (node9 && node9.fieldValue === "None") {
    ok("nodeId=9 (unused image)", `fieldValue=None`);
  } else {
    fail("nodeId=9 (unused image)", `fieldValue=${node9?.fieldValue}`);
  }

  // Check prompt
  const promptNode = nodeInfoList.find((n) => n.nodeId === "1" && n.fieldName === "prompt");
  if (promptNode && promptNode.fieldValue === prompt) {
    ok("nodeId=1 prompt", `matches input`);
  } else {
    fail("nodeId=1 prompt", `fieldValue=${promptNode?.fieldValue}`);
  }

  // Check duration
  const durationNode = nodeInfoList.find((n) => n.nodeId === "1" && n.fieldName === "duration");
  if (durationNode && durationNode.fieldValue === "8") {
    ok("nodeId=1 duration", `fieldValue=8`);
  } else {
    fail("nodeId=1 duration", `fieldValue=${durationNode?.fieldValue}`);
  }

  // Check ratio
  const ratioNode = nodeInfoList.find((n) => n.nodeId === "1" && n.fieldName === "ratio");
  if (ratioNode && ratioNode.fieldValue === "16:9") {
    ok("nodeId=1 ratio", `fieldValue=16:9`);
  } else {
    fail("nodeId=1 ratio", `fieldValue=${ratioNode?.fieldValue}`);
  }

  // Check resolution
  const resNode = nodeInfoList.find((n) => n.nodeId === "1" && n.fieldName === "resolution");
  if (resNode && resNode.fieldValue === "720p") {
    ok("nodeId=1 resolution", `fieldValue=720p`);
  } else {
    fail("nodeId=1 resolution", `fieldValue=${resNode?.fieldValue}`);
  }

  // Check real_person_mode
  const rpmNode = nodeInfoList.find((n) => n.nodeId === "1" && n.fieldName === "real_person_mode");
  if (rpmNode && rpmNode.fieldValue === "true") {
    ok("nodeId=1 real_person_mode", `fieldValue=true`);
  } else {
    fail("nodeId=1 real_person_mode", `fieldValue=${rpmNode?.fieldValue}`);
  }

  return true;
}

// ---- 检查 5（可选）: 真实提交 -----------------------------------------------

async function checkRealSubmit(): Promise<boolean> {
  if (!VERIFY_AI_APP) {
    warn("real submit", `跳过（设置 RUNNINGHUB_VERIFY_AI_APP=1 启用）`);
    return true;
  }

  const imageUrlsRaw =
    process.env.RUNNINGHUB_VERIFY_IMAGE_URLS ||
    "https://example.com/verify-image1.png,https://example.com/verify-image2.png";
  const imageUrls = imageUrlsRaw.split(",").map((s) => s.trim());
  const prompt =
    process.env.RUNNINGHUB_VERIFY_PROMPT ||
    "Image1 角色按照video1运镜展示，画面风格与image1保持一致";

  info("real submit", `images=${imageUrls.length}, prompt=${prompt.slice(0, 40)}...`);

  try {
    const taskId = await submitVideoTask(prompt, imageUrls, "16:9", "720p", "15");
    ok("real submit", `taskId=${taskId}`);
    return true;
  } catch (err: any) {
    fail("real submit", err.message);
    return false;
  }
}

// ---- main ----------------------------------------------------------------

async function main() {
  console.log("");
  console.log("  [verify] === RunningHub AI App 集成验证 ===");
  console.log("");

  divider();
  const keyOk = checkApiKey();
  divider();
  const urlOk = checkUrls();
  divider();
  const normOk = checkNormalizeFunctions();
  divider();
  const nodeOk = checkNodeInfoList();
  divider();
  const submitOk = await checkRealSubmit();
  divider();

  console.log("");

  const allPassed = VERIFY_AI_APP
    ? keyOk && urlOk && normOk && nodeOk && submitOk
    : urlOk && normOk && nodeOk && submitOk;
  if (allPassed) {
    console.log("  [verify] ✓ 全部检查通过");
  } else {
    console.log("  [verify] ✗ 部分检查未通过，请查看上面的错误信息");
  }

  console.log("");
  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error("  [verify] Fatal:", err);
  process.exit(1);
});

