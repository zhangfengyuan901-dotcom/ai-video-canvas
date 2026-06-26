// =========================================================================
// verify-8-clip-diagnostics-ui-static.ts
// =========================================================================
// 静态验证脚本：检查前端关键文件是否存在 mojibake 乱码，
// 并确认 ClipDiagnosticsPanel 已接入 diagnostics detail endpoint。
// 不需要启动 server，不需要 API Key。
// =========================================================================

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const PROJECT_ROOT = process.cwd();

function read(file: string): string {
  const fullPath = path.join(PROJECT_ROOT, file);
  if (!existsSync(fullPath)) {
    console.error(`[FAIL] File not found: ${file}`);
    process.exit(1);
  }
  return readFileSync(fullPath, "utf8");
}

let ok = true;

// ---- 检查 1：无 mojibake 乱码 ------------------------------------------

const files = [
  "apps/web/src/components/scene/SceneVideoPanel.tsx",
  "apps/web/src/hooks/useVideoClips.ts",
  "apps/web/src/components/scene/ClipDiagnosticsPanel.tsx",
];

const mojibakePatterns = [
  "\uFFFD", // Unicode replacement character
  "鈥�", "鐢熸", "瑙嗛", "鍒锋", "閲嶆", "鍏变韩", "鎷夊彇",
];

for (const file of files) {
  const content = read(file);

  for (const pattern of mojibakePatterns) {
    if (content.includes(pattern)) {
      console.error(`[FAIL] ${file} contains mojibake pattern: ${pattern}`);
      ok = false;
    }
  }
}

if (ok) {
  console.log("[PASS] No mojibake patterns found");
}

// ---- 检查 2：ClipDiagnosticsPanel 接入 detail endpoint ------------------

const panelContent = read("apps/web/src/components/scene/ClipDiagnosticsPanel.tsx");

const requiredSnippets = [
  "/diagnostics",
  "VideoClipDiagnosticsDetail",
  "loadFullDiagnostics",
  "setFullDiagnostics",
  "detailLoaded",
];

for (const snippet of requiredSnippets) {
  if (!panelContent.includes(snippet)) {
    console.error(`[FAIL] ClipDiagnosticsPanel missing: ${snippet}`);
    ok = false;
  }
}

if (ok) {
  console.log("[PASS] ClipDiagnosticsPanel has all required snippets");
}

// ---- 检查 3：results URL 不展示完整 URL --------------------------------

const urlSlicePattern = /r\.url\s*\.slice\(-32\)/;
if (!urlSlicePattern.test(panelContent)) {
  console.warn("[WARN] ClipDiagnosticsPanel may expose full result URLs");
}

// ---- 检查 4：useVideoClips 无 c: any 遗留 --------------------------------

const hookContent = read("apps/web/src/hooks/useVideoClips.ts");

if (hookContent.includes("c: any")) {
  console.error(`[FAIL] useVideoClips.ts still has c: any`);
  ok = false;
} else {
  console.log("[PASS] useVideoClips.ts has no any-type cast");
}

// ---- 总结 ---------------------------------------------------------------

if (!ok) {
  console.error("\n[FAIL] Static verification failed");
  process.exit(1);
}

console.log("\n[PASS] Clip diagnostics UI static checks passed");
