// =========================================================================
// verify-10-video-retry-static.ts
// =========================================================================
// 静态验证：检查 retry lineage 字段、retryFailedClip 函数、retry endpoint、
// retry worker、前端 retry 集成等是否正确接入。
// 不依赖 server，不依赖 API Key。
// =========================================================================

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

var PROJECT_ROOT = process.cwd();

function read(file: string): string {
  var fullPath = path.join(PROJECT_ROOT, file);
  if (!existsSync(fullPath)) { console.error("[FAIL] Missing:", file); process.exit(1); }
  return readFileSync(fullPath, "utf8");
}

var ok = true;

// ---- 检查 1：Schema retry 字段 ------------------------------------------

var schema = read("apps/server/src/db/schema.ts");
var schemaChecks = ["retryOfClipId", "retryReason", "retryCreatedAt"];
for (var sc of schemaChecks) {
  if (!schema.includes(sc)) { console.error("[FAIL] schema missing:", sc); ok = false; }
}
if (ok) console.log("[PASS] Schema has retry fields");

// ---- 检查 2：Shared types ------------------------------------------------

var shared = read("packages/shared/src/types.ts");
var sharedChecks = ["VideoRetryResponse", "retrySource", "retryChildren"];
for (var sh of sharedChecks) {
  if (!shared.includes(sh)) { console.error("[FAIL] shared types missing:", sh); ok = false; }
}
if (ok) console.log("[PASS] Shared types have retry types");

// ---- 检查 3：VideoService ------------------------------------------------

var vs = read("apps/server/src/services/VideoService.ts");
var vsChecks = ["export async function retryFailedClip", "retryOfClipId", "retryReason", "options."];
for (var vc of vsChecks) {
  if (!vs.includes(vc)) { console.error("[FAIL] VideoService missing:", vc); ok = false; }
}
if (ok) console.log("[PASS] VideoService has retryFailedClip + options");

// ---- 检查 4：VideoRetryWorker --------------------------------------------

if (!existsSync("apps/server/src/services/jobs/VideoRetryWorker.ts")) {
  console.error("[FAIL] VideoRetryWorker.ts missing"); ok = false;
} else {
  var worker = read("apps/server/src/services/jobs/VideoRetryWorker.ts");
  if (!worker.includes("retryFailedClip")) { console.error("[FAIL] VideoRetryWorker missing retryFailedClip"); ok = false; }
  if (!worker.includes("startVideoRetryWorker")) { console.error("[FAIL] VideoRetryWorker missing export"); ok = false; }
  if (ok) console.log("[PASS] VideoRetryWorker exists");
}

// ---- 检查 5：video routes ------------------------------------------------

var vr = read("apps/server/src/routes/video.ts");
var vrChecks = ["startVideoRetryWorker", "/retry", "annotateClipsWithRetryLineage"];
for (var vrc of vrChecks) {
  if (!vr.includes(vrc)) { console.error("[FAIL] video routes missing:", vrc); ok = false; }
}
if (ok) console.log("[PASS] Video routes have retry endpoint + lineage");

// ---- 检查 6：useVideoClips hook ------------------------------------------

var hook = read("apps/web/src/hooks/useVideoClips.ts");
if (!hook.includes("retryFailedClip")) { console.error("[FAIL] useVideoClips missing retryFailedClip"); ok = false; }
if (!hook.includes("VideoRetryResponse")) { console.error("[FAIL] useVideoClips missing VideoRetryResponse"); ok = false; }
if (ok) console.log("[PASS] useVideoClips has retryFailedClip");

// ---- 检查 7：SceneVideoPanel ---------------------------------------------

var svp = read("apps/web/src/components/scene/SceneVideoPanel.tsx");
if (!svp.includes("handleRetryFailedClip")) { console.error("[FAIL] SceneVideoPanel missing handleRetryFailedClip"); ok = false; }
if (ok) console.log("[PASS] SceneVideoPanel has retry handler");

// ---- 检查 8：ClipDiagnosticsDrawer ---------------------------------------

var drawer = read("apps/web/src/components/scene/ClipDiagnosticsDrawer.tsx");
var drawerChecks = ["Retry Lineage", "创建重试版本", "retrySource", "retryChildren"];
for (var dc of drawerChecks) {
  if (!drawer.includes(dc)) { console.error("[FAIL] Drawer missing:", dc); ok = false; }
}
if (ok) console.log("[PASS] Drawer shows retry lineage + button");

// ---- 检查 9：ClipDiagnosticsDto ------------------------------------------

var dto = read("apps/server/src/services/video/ClipDiagnosticsDto.ts");
if (!dto.includes("retryOfClipId")) { console.error("[FAIL] ClipDiagnosticsDto missing retryOfClipId"); ok = false; }
if (ok) console.log("[PASS] ClipDiagnosticsDto has retry mapping");

// ---- 检查 10：No mojibake / Ark ------------------------------------------

var badPatterns = ["\uFFFD", "鈥�", "鐢熸", "瑙嗛", "鍒锋", "閲嶆", "Ark", "ARK_", "VIDEO_PROVIDER", "VideoProviderService"];
var filesToCheck = [schema, shared, vs, vr, dto, worker, hook, svp, drawer];
var fileNames = ["schema", "shared", "VideoService", "routes", "dto", "worker", "hook", "SceneVideoPanel", "drawer"];
for (var fi = 0; fi < filesToCheck.length; fi++) {
  var content = filesToCheck[fi];
  var name = fileNames[fi];
  for (var bp of badPatterns) {
    if (content.includes(bp)) { console.error("[FAIL]", name, "contains forbidden pattern:", bp); ok = false; }
  }
}
if (ok) console.log("[PASS] No mojibake or Ark patterns found");

// ---- 总结 ---------------------------------------------------------------

if (!ok) { console.error("\n[FAIL] Verification failed"); process.exit(1); }
console.log("\n[PASS] Video retry static checks passed");
