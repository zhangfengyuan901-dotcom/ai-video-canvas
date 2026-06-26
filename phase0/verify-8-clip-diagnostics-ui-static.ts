// =========================================================================
// verify-8-clip-diagnostics-ui-static.ts
// =========================================================================
// Static verification script: Checkfrontend key files for mojibake mojibake mojibake, 
// and confirm diagnostics components are properly wired via shared hooks.
// No server startup or API key required.
// =========================================================================

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

var PROJECT_ROOT = process.cwd();

function read(file: string) {
  var fullPath = path.join(PROJECT_ROOT, file);
  if (!existsSync(fullPath)) { console.error("[FAIL] File not found:", file); process.exit(1); }
  return readFileSync(fullPath, "utf8");
}

var ok = true;

// ---- Check 1: No  mojibake mojibake ------------------------------------------

var files = [
  "apps/web/src/components/scene/SceneVideoPanel.tsx",
  "apps/web/src/hooks/useVideoClips.ts",
  "apps/web/src/components/scene/ClipDiagnosticsPanel.tsx",
  "apps/web/src/components/scene/ClipDiagnosticsDrawer.tsx",
];

var mojibakePatterns = ["\uFFFD", "\u9225\uFFFD", "\u9422\u71B8", "\u7459\u55DB", "\u9352\u950B", "\u95B2\u5D86", "\u934F\u53D8\u97E9", "\u93B7\u590A\u5F47"];

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

// ---- Check 2: ClipDiagnosticsPanel usesshared hook -------------------------

var panelContent = read("apps/web/src/components/scene/ClipDiagnosticsPanel.tsx");
var panelChecks = ["useClipDiagnosticsDetail", "onOpenDrawer"];
for (var pc of panelChecks) {
  if (!panelContent.includes(pc)) { console.error("[FAIL] ClipDiagnosticsPanel missing:", pc); ok = false; }
}

// ---- Check 3: ClipDiagnosticsDrawer correctly wired -------------------------------

var drawerContent = read("apps/web/src/components/scene/ClipDiagnosticsDrawer.tsx");
var drawerChecks = ["useClipDiagnosticsDetail", "DiagnosticsCopyButton", "buildRunningHubRetryGuidance"];
for (var dc of drawerChecks) {
  if (!drawerContent.includes(dc)) { console.error("[FAIL] ClipDiagnosticsDrawer missing:", dc); ok = false; }
}

// ---- Check 4: Hook references detail types -------------------------------------

var hookContent = read("apps/web/src/hooks/useClipDiagnosticsDetail.ts");
var hookChecks = ["VideoClipDiagnosticsDetail", "/diagnostics"];
for (var hc of hookChecks) {
  if (!hookContent.includes(hc)) { console.error("[FAIL] useClipDiagnosticsDetail missing:", hc); ok = false; }
}
if (ok) console.log("[PASS] All diagnostics integration checks passed");

// ---- Check 5: useVideoClips No  c: any remnant --------------------------------

var hook2Content = read("apps/web/src/hooks/useVideoClips.ts");
if (hook2Content.includes("c: any")) { console.error("[FAIL] useVideoClips.ts still has c: any"); ok = false; }
else console.log("[PASS] useVideoClips.ts has no any-type cast");

// ---- Summary ---------------------------------------------------------------

if (!ok) { console.error("\n[FAIL] Static verification failed"); process.exit(1); }
console.log("\n[PASS] Clip diagnostics UI static checks passed");
