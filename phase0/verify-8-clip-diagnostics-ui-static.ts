// =========================================================================
// verify-8-clip-diagnostics-ui-static.ts
// =========================================================================
// 静态验证脚本：检查前端关键文件是否存在 mojibake 乱码，
// 并确认 diagnostics 组件通过共享 hook 正常接入诊断功能。
// 不需要启动 server，不需要 API Key。
// =========================================================================

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

var PROJECT_ROOT = process.cwd();

function read(file) {
  var fullPath = path.join(PROJECT_ROOT, file);
  if (!existsSync(fullPath)) { console.error("[FAIL] File not found:", file); process.exit(1); }
  return readFileSync(fullPath, "utf8");
}

var ok = true;

// ---- 检查 1：无 mojibake 乱码 ------------------------------------------

var files = [
  "apps/web/src/components/scene/SceneVideoPanel.tsx",
  "apps/web/src/hooks/useVideoClips.ts",
  "apps/web/src/components/scene/ClipDiagnosticsPanel.tsx",
  "apps/web/src/components/scene/ClipDiagnosticsDrawer.tsx",
];

var mojibakePatterns = ["\uFFFD", "鈥�", "鐢熸", "瑙嗛", "鍒锋", "閲嶆", "鍏变韩", "鎷夊彇"];

for (var file of files) {
  var content = read(file);
  for (var pattern of mojibakePatterns) {
    if (content.includes(pattern)) {
      console.error("[FAIL] " + file + " contains mojibake: " + pattern);
      ok = false;
    }
  }
}
if (ok) console.log("[PASS] No mojibake patterns found");

// ---- 检查 2：ClipDiagnosticsPanel 使用共享 hook -------------------------

var panelContent = read("apps/web/src/components/scene/ClipDiagnosticsPanel.tsx");
var panelChecks = ["useClipDiagnosticsDetail", "onOpenDrawer"];
for (var pc of panelChecks) {
  if (!panelContent.includes(pc)) { console.error("[FAIL] ClipDiagnosticsPanel missing:", pc); ok = false; }
}

// ---- 检查 3：ClipDiagnosticsDrawer 正确接入 -------------------------------

var drawerContent = read("apps/web/src/components/scene/ClipDiagnosticsDrawer.tsx");
var drawerChecks = ["useClipDiagnosticsDetail", "DiagnosticsCopyButton", "buildRunningHubRetryGuidance"];
for (var dc of drawerChecks) {
  if (!drawerContent.includes(dc)) { console.error("[FAIL] ClipDiagnosticsDrawer missing:", dc); ok = false; }
}

// ---- 检查 4：Hook 引用 detail types -------------------------------------

var hookContent = read("apps/web/src/hooks/useClipDiagnosticsDetail.ts");
var hookChecks = ["VideoClipDiagnosticsDetail", "/diagnostics"];
for (var hc of hookChecks) {
  if (!hookContent.includes(hc)) { console.error("[FAIL] useClipDiagnosticsDetail missing:", hc); ok = false; }
}
if (ok) console.log("[PASS] All diagnostics integration checks passed");

// ---- 检查 5：useVideoClips 无 c: any 遗留 --------------------------------

var hook2Content = read("apps/web/src/hooks/useVideoClips.ts");
if (hook2Content.includes("c: any")) { console.error("[FAIL] useVideoClips.ts still has c: any"); ok = false; }
else console.log("[PASS] useVideoClips.ts has no any-type cast");

// ---- 总结 ---------------------------------------------------------------

if (!ok) { console.error("\n[FAIL] Static verification failed"); process.exit(1); }
console.log("\n[PASS] Clip diagnostics UI static checks passed");
