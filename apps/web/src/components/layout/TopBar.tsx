// =========================================================================
// TopBar — 顶部工具条 (redesigned with glassmorphism + gradient buttons)
// =========================================================================

import { useProjectStore } from "../../stores/projectStore";
import { useState, useEffect } from "react";
import { useApi } from "../../hooks/useApi";
import ExportPreflightModal from "../export/ExportPreflightModal";
import ApiSettingsPanel from "../settings/ApiSettingsPanel";
import { Settings, Download, Film, ArrowUpFromLine } from "lucide-react";

export default function TopBar() {
  const currentProject = useProjectStore((s) => s.currentProject);
  const { post, get } = useApi();

  const [exportJobId, setExportJobId] = useState<string | null>(null);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [exportFilename, setExportFilename] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [showPreflight, setShowPreflight] = useState(false);
  const [showApiSettings, setShowApiSettings] = useState(false);

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
    <header className="h-14 bg-[#08090c]/80 border-b border-white/[0.06] flex items-center px-5 gap-3 shrink-0 backdrop-blur-md">
      {/* Logo / Product name */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 shadow-sm shadow-blue-500/20">
          <Film className="h-3.5 w-3.5 text-white" />
        </div>
        <span className="text-sm font-semibold tracking-tight text-zinc-100">
          AI 视频画布
        </span>
      </div>

      <div className="h-5 w-px bg-white/[0.06]" />

      {/* Project info */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {currentProject ? (
          <>
            <span className="text-sm font-medium text-zinc-200 truncate">
              {currentProject.title}
            </span>
            <span className="text-[11px] text-zinc-500 shrink-0">
              {currentProject.aspectRatio} · {currentProject.resolution}
            </span>
          </>
        ) : (
          <span className="text-sm text-zinc-600">未打开项目</span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {exportError && (
          <span className="text-[11px] text-rose-400">{exportError}</span>
        )}

        {currentProject && showDownload ? (
          <a
            href={`/api/projects/${currentProject.id}/exports/${exportFilename}`}
            download
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400 transition-all hover:bg-emerald-500/20 hover:text-emerald-300 no-underline"
          >
            <Download className="h-3.5 w-3.5" />
            下载 {exportFilename}
          </a>
        ) : currentProject ? (
          <button
            onClick={handleExportClick}
            disabled={isExporting}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              isExporting
                ? "bg-blue-600/20 text-blue-400 animate-pulse cursor-not-allowed"
                : "bg-gradient-to-b from-blue-500 to-blue-600 text-white shadow-sm shadow-blue-500/20 hover:from-blue-400 hover:to-blue-500 active:from-blue-600 active:to-blue-700"
            }`}
          >
            {isExporting ? (
              <>导出中... {exportProgress}%</>
            ) : (
              <>
                <ArrowUpFromLine className="h-3.5 w-3.5" />
                导出
              </>
            )}
          </button>
        ) : null}

        <button
          onClick={() => setShowApiSettings(true)}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 transition-all hover:text-zinc-300 hover:bg-white/[0.06] active:bg-white/[0.03]"
          title="API 配置"
        >
          <Settings className="h-3.5 w-3.5" />
        </button>

        <span className="rounded-md border border-zinc-700/30 bg-zinc-800/60 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">
          Phase 4 · 图生视频
        </span>
      </div>

      {/* Modals */}
      {showPreflight && currentProject && (
        <ExportPreflightModal
          projectId={currentProject.id}
          onClose={() => setShowPreflight(false)}
          onConfirm={(allowPartial) => startExport(allowPartial)}
        />
      )}
      {showApiSettings && (
        <ApiSettingsPanel onClose={() => setShowApiSettings(false)} />
      )}
    </header>
  );
}
