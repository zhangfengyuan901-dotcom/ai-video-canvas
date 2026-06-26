// =========================================================================
// TopBar — 顶部工具条
// =========================================================================

import { useProjectStore } from "../../stores/projectStore";
import { useState, useEffect } from "react";
import { useApi } from "../../hooks/useApi";
import ExportPreflightModal from "../export/ExportPreflightModal";

export default function TopBar() {
  const currentProject = useProjectStore((s) => s.currentProject);
  const { post, get } = useApi();

  const [exportJobId, setExportJobId] = useState<string | null>(null);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [exportFilename, setExportFilename] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [showPreflight, setShowPreflight] = useState(false);

  // ---- Poll export job --------------------------------------------------

  useEffect(() => {
    if (!exportJobId) return;
    const poll = setInterval(async () => {
      try {
        const job = await get<{ status: string; progress: number; resultJson?: string; error?: string }>(`/jobs/${exportJobId}`);
        setExportProgress(job.progress);
        if (job.status === "success") {
          setExportJobId(null);
          const result = job.resultJson ? JSON.parse(job.resultJson) : {};
          setExportFilename(result.filename ?? null);
        } else if (job.status === "failed") {
          setExportJobId(null);
          setExportError(job.error ?? "导出失败");
          setTimeout(() => setExportError(null), 8000);
        } else if (job.status === "cancelled") {
          setExportJobId(null);
          setExportError("已取消");
          setTimeout(() => setExportError(null), 5000);
        }
      } catch { /* silent */ }
    }, 2000);
    return () => clearInterval(poll);
  }, [exportJobId, get]);

  // ---- Restore running export job on refresh ----------------------------

  useEffect(() => {
    if (!currentProject) return;
    (async () => {
      try {
        const jobs = await get<any[]>(`/projects/${currentProject.id}/jobs`);
        const runningJob = jobs.find(
          (j) => j.type === "EXPORT_VIDEO" && (j.status === "queued" || j.status === "running"),
        );
        if (runningJob) {
          setExportJobId(runningJob.id);
          setExportProgress(runningJob.progress ?? 0);
        }
      } catch { /* silent */ }
    })();
  }, [currentProject?.id, get]);

  // ---- Handle export ----------------------------------------------------

  function handleExportClick() {
    if (!currentProject || exportJobId) return;
    setShowPreflight(true);
  }

  async function startExport(allowPartial: boolean) {
    if (!currentProject || exportJobId) return;
    setShowPreflight(false);
    setExportFilename(null);
    setExportError(null);
    setExportProgress(0);
    try {
      const data = await post<{ jobId: string }>(
        `/projects/${currentProject.id}/export`,
        { allowPartial },
      );
      setExportJobId(data.jobId);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "导出失败");
      setTimeout(() => setExportError(null), 5000);
    }
  }

  const isExporting = !!exportJobId;
  const showDownload = !!exportFilename && currentProject;

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
      {exportError && (
        <span className="text-xs text-red-400 mr-2">{exportError}</span>
      )}
      {currentProject && (
        showDownload ? (
          <a
            href={`/api/projects/${currentProject.id}/exports/${exportFilename}`}
            download
            className="text-xs px-3 py-1 rounded font-medium bg-green-700 hover:bg-green-600 text-white transition-colors no-underline"
          >
            下载 {exportFilename}
          </a>
        ) : (
          <button
            onClick={handleExportClick}
            disabled={isExporting}
            className={`text-xs px-3 py-1 rounded font-medium transition-colors ${
              isExporting
                ? "bg-blue-600/20 text-blue-400 animate-pulse cursor-not-allowed"
                : "bg-green-700 hover:bg-green-600 text-white"
            }`}
          >
            {isExporting ? `导出中... ${exportProgress}%` : "导出完整视频"}
          </button>
        )
      )}
      {showPreflight && currentProject && (
        <ExportPreflightModal
          projectId={currentProject.id}
          onClose={() => setShowPreflight(false)}
          onConfirm={(allowPartial) => startExport(allowPartial)}
        />
      )}
      <span className="text-xs text-zinc-600">Phase 4 · 图生视频</span>
    </header>
  );
}
