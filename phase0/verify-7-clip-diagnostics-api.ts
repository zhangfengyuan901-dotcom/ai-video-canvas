// =========================================================================
// verify-7-clip-diagnostics-api.ts
// =========================================================================
// 验证 Clip Diagnostics API — 检查列表和 detail endpoint 返回诊断 DTO。
// 不要求 RunningHub 真实任务成功。
// 依赖本地 server 运行 (npm run dev)。
// =========================================================================

const BASE = "http://localhost:3001/api";

async function main() {
  console.log("=== Video Clip Diagnostics API Verification ===\n");

  // 1. 获取项目列表
  console.log("1. GET /projects");
  const projectsRes = await fetch(`${BASE}/projects`);
  const projectsJson = await projectsRes.json();
  if (!projectsJson.success || !Array.isArray(projectsJson.data) || projectsJson.data.length === 0) {
    console.log("   No projects found. Skipping.");
    return;
  }
  const project = projectsJson.data[0];
  console.log(`   Project: ${project.id} (${project.title})\n`);

  // 2. 获取视频列表
  console.log(`2. GET /projects/${project.id}/videos`);
  const videosRes = await fetch(`${BASE}/projects/${project.id}/videos`);
  const videosJson = await videosRes.json();
  if (!videosJson.success || !Array.isArray(videosJson.data)) {
    console.log("   FAIL: videos list API failed");
    process.exit(1);
  }

  const clips = videosJson.data;
  console.log(`   Found ${clips.length} clip(s)\n`);

  let clipChecked = 0;
  let detailChecked = 0;
  let diagnosticsCount = 0;

  for (const clip of clips) {
    clipChecked++;

    // 3. 检查 diagnostics 字段存在
    const hasDiagnostics = clip.diagnostics !== undefined && clip.diagnostics !== null;
    if (hasDiagnostics) diagnosticsCount++;

    const hasInputPanelIds = Array.isArray(clip.inputPanelIds);
    const hasIsCurrent = typeof clip.isCurrent === "boolean";

    console.log(`   Clip ${clip.id.slice(0, 8)}... (v${clip.version}, ${clip.status})`);
    console.log(`      diagnostics: ${hasDiagnostics ? "PASS" : "FAIL"}`);
    if (hasDiagnostics) {
      console.log(`        status: ${clip.diagnostics.status ?? "(null)"}`);
      console.log(`        outputNodeId: ${clip.diagnostics.outputNodeId ?? "(null)"}`);
      console.log(`        outputType: ${clip.diagnostics.outputType ?? "(null)"}`);
      console.log(`        taskCostTime: ${clip.diagnostics.taskCostTime ?? "(null)"}`);
      console.log(`        lastPolledAt: ${clip.diagnostics.lastPolledAt ?? "(null)"}`);
      console.log(`        completedAt: ${clip.diagnostics.completedAt ?? "(null)"}`);
    }
    console.log(`      inputPanelIds: ${hasInputPanelIds ? "PASS" : "FAIL"}`);
    console.log(`      isCurrent: ${hasIsCurrent ? `PASS (${clip.isCurrent})` : "FAIL"}`);

    // 4. 调用 detail endpoint
    if (clip.sceneId) {
      console.log(`   -> GET /projects/${project.id}/scenes/${clip.sceneId}/videos/${clip.id}/diagnostics`);
      const detailRes = await fetch(
        `${BASE}/projects/${project.id}/scenes/${clip.sceneId}/videos/${clip.id}/diagnostics`,
      );
      const detailJson = await detailRes.json();
      detailChecked++;

      if (detailJson.success && detailJson.data) {
        const dd = detailJson.data;
        const hasDiag = dd.diagnostics !== undefined && dd.diagnostics !== null;
        console.log(`      success: PASS`);
        console.log(`      clipId: ${dd.clipId?.slice(0, 8) ?? "FAIL"}...`);
        console.log(`      version: ${dd.version}`);
        console.log(`      taskId: ${dd.taskId ?? "(null)"}`);
        console.log(`      diagnostics: ${hasDiag ? "PASS" : "FAIL"}`);
        if (hasDiag) {
          console.log(`        errorCode: ${dd.diagnostics.errorCode ?? "(null)"}`);
          console.log(`        errorMessage: ${dd.diagnostics.errorMessage ?? "(null)"}`);
          console.log(`        promptTips: ${dd.diagnostics.promptTips ? dd.diagnostics.promptTips.slice(0, 60) + "..." : "(null)"}`);
          console.log(`        usage: ${dd.diagnostics.usage ? JSON.stringify(dd.diagnostics.usage).slice(0, 100) : "(null)"}`);
          console.log(`        results: ${Array.isArray(dd.diagnostics.results) ? `${dd.diagnostics.results.length} item(s)` : "(null)"}`);
          console.log(`        failedReason: ${dd.diagnostics.failedReason ? JSON.stringify(dd.diagnostics.failedReason).slice(0, 80) : "(null)"}`);
        }
      } else {
        console.log(`      FAIL: ${detailJson.error ?? "unknown error"}`);
      }
    }
    console.log("");
  }

  // Summary
  console.log("=== Summary ===");
  console.log(`Clips checked: ${clipChecked}`);
  console.log(`Detail endpoints: ${detailChecked}`);
  console.log(`Clips with diagnostics: ${diagnosticsCount}/${clipChecked}`);
  console.log(`Diagnostics coverage: ${clipChecked > 0 ? `${(diagnosticsCount / clipChecked * 100).toFixed(0)}%` : "N/A"}`);

  if (clipChecked > 0 && diagnosticsCount > 0) {
    console.log("\nResult: PASS");
  } else if (clipChecked === 0) {
    console.log("\nResult: SKIP (no clips)");
  } else {
    console.log("\nResult: FAIL (no diagnostics)");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});