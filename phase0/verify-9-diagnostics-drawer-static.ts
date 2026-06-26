// =========================================================================
// verify-9-diagnostics-drawer-static.ts
// =========================================================================
// 静态验证：检查诊断抽屉、工具函数、复制按钮等组件是否完整接入。
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
var requiredFiles = [
  "apps/web/src/components/scene/ClipDiagnosticsDrawer.tsx",
  "apps/web/src/components/scene/DiagnosticsCopyButton.tsx",
  "apps/web/src/hooks/useClipDiagnosticsDetail.ts",
  "apps/web/src/utils/runninghubDiagnostics.ts",
];
for (var file of requiredFiles) {
  if (!existsSync(file)) { console.error("[FAIL] Missing:", file); ok = false; }
}
if (ok) console.log("[PASS] All required files exist");

var sceneVideoPanel = read("apps/web/src/components/scene/SceneVideoPanel.tsx");
var drawer = read("apps/web/src/components/scene/ClipDiagnosticsDrawer.tsx");
var utils = read("apps/web/src/utils/runninghubDiagnostics.ts");

var checks = [
  ["SceneVideoPanel", sceneVideoPanel, "ClipDiagnosticsDrawer"],
  ["SceneVideoPanel", sceneVideoPanel, "diagnosticsDrawerOpen"],
  ["Drawer", drawer, "useClipDiagnosticsDetail"],
  ["Drawer", drawer, "buildRunningHubRetryGuidance"],
  ["Drawer", drawer, "DiagnosticsCopyButton"],
  ["Utils", utils, "buildRunningHubRetryGuidance"],
  ["Utils", utils, "prettyJson"],
  ["Utils", utils, "redactUrl"],
];
for (var check of checks) {
  if (!check[1].includes(check[2])) { console.error("[FAIL]", check[0], "missing", check[2]); ok = false; }
}
if (ok) console.log("[PASS] All component/hook wiring checks passed");

var mojibakePatterns = ["\uFFFD", "鈥�", "鐢熸", "瑙嗛", "鍒锋", "閲嶆", "鍏变韩", "鎷夊彇"];
for (var file2 of [...requiredFiles, "apps/web/src/components/scene/SceneVideoPanel.tsx", "apps/web/src/components/scene/ClipDiagnosticsPanel.tsx"]) {
  var content2 = read(file2);
  for (var mp of mojibakePatterns) {
    if (content2.includes(mp)) { console.error("[FAIL]", file2, "contains mojibake:", mp); ok = false; }
  }
}
if (ok) console.log("[PASS] No mojibake patterns found");

if (!ok) { console.error("\n[FAIL] Verification failed"); process.exit(1); }
console.log("\n[PASS] Diagnostics drawer static checks passed");
