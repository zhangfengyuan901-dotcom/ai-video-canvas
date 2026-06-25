// =========================================================================
// TopBar — 顶部工具条
// =========================================================================

import { useProjectStore } from "../../stores/projectStore";
import { useState } from "react";
import { useApi } from "../../hooks/useApi";

export default function TopBar() {
  const currentProject = useProjectStore((s) => s.currentProject);
  const { post } = useApi();
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState<string | null>(null);

  async function handleExport() {
    if (!currentProject || exporting) return;
    setExporting(true);
    setExportMsg(null);
    try {
      const result = await post<{ sceneCount: number; outputPath?: string; missingScenes?: string[] }>(
        `/projects/${currentProject.id}/export`,
      );
      if (result.outputPath) {
        setExportMsg(`✅ 导出成功 · ${result.sceneCount} 个片段`);
      } else {
        setExportMsg(`❌ 导出失败`);
      }
    } catch (err) {
      setExportMsg(`❌ ${err instanceof Error ? err.message : "导出失败"}`);
    } finally {
      setExporting(false);
      setTimeout(() => setExportMsg(null), 5000);
    }
  }

  return (
    <header className="h-12 bg-zinc-900 border-b border-zinc-800 flex items-center px-4 gap-4 shrink-0">
      <h1 className="font-semibold text-sm tracking-wide text-zinc-200">AI 视频画布</h1>
      <span className="text-zinc-600">|</span>
      {currentProject ? (
        <span className="text-sm text-zinc-400">
          {currentProject.title}
          <span className="ml-2 text-xs text-zinc-600">
            {currentProject.aspectRatio} · {currentProject.resolution}
          </span>
        </span>
      ) : (
        <span className="text-sm text-zinc-600">未打开项目</span>
      )}
      <div className="flex-1" />
      {exportMsg && (
        <span className="text-xs text-zinc-400 mr-2">{exportMsg}</span>
      )}
      {currentProject && (
        <button
          onClick={handleExport}
          disabled={exporting}
          className={`text-xs px-3 py-1 rounded font-medium transition-colors ${
            exporting
              ? "bg-blue-600/20 text-blue-400 animate-pulse cursor-not-allowed"
              : "bg-green-700 hover:bg-green-600 text-white"
          }`}
        >
          {exporting ? "导出中..." : "导出完整视频"}
        </button>
      )}
      <span className="text-xs text-zinc-600">Phase 4 · 图生视频</span>
    </header>
  );
}
