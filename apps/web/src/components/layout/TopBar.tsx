// =========================================================================
// TopBar — 顶部工具条 (redesigned to match UI mockup)
// =========================================================================

import { useProjectStore } from "../../stores/projectStore";
import { useUIStore } from "../../stores/uiStore";
import { useState, useEffect } from "react";
import { useApi } from "../../hooks/useApi";
import ExportPreflightModal from "../export/ExportPreflightModal";
import ApiSettingsPanel from "../settings/ApiSettingsPanel";
import { Settings, Download, Film, ArrowUpFromLine } from "lucide-react";

export default function TopBar() {
  const currentProject = useProjectStore((s) => s.currentProject);
  const { apiStatus, setApiStatus } = useUIStore();
  const { post, get } = useApi();

  const [exportJobId, setExportJobId] = useState<string | null>(null);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [exportFilename, setExportFilename] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [showPreflight, setShowPreflight] = useState(false);
  const [showApiSettings, setShowApiSettings] = useState(false);

  // ---- Check API health on mount ---------------------------------------
  useEffect(() => {
    setApiStatus("checking");
    get<{ status: string }>("/health")
      .then(() => setApiStatus("connected"))
      .catch(() => setApiStatus("disconnected"));
  }, []);

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
          setExportError(job.error ?? "Export failed");
          setTimeout(() => setExportError(null), 8000);
        } else if (job.status === "cancelled") {
          setExportJobId(null);
          setExportError("Cancelled");
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
      setExportError(err instanceof Error ? err.message : "Export failed");
      setTimeout(() => setExportError(null), 5000);
    }
  }

  const isExporting = !!exportJobId;
  const showDownload = !!exportFilename && currentProject;

  return (
    <header className="h-14 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-4 shrink-0 z-20 shadow-md">
      {/* Left: Logo + Project info */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded flex items-center justify-center">
          <Film className="h-4 w-4 text-white" />
        </div>
        <h1 className="font-bold text-lg tracking-wide text-gray-100">AI Video Canvas</h1>
        <span className="text-xs text-gray-400 bg-gray-700 px-2 py-0.5 rounded">v1.0.0 Local</span>

        <div className="h-5 w-px bg-gray-700 mx-1" />

        {/* Project info */}
        {currentProject ? (
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-medium text-gray-200 truncate max-w-[200px]">
              {currentProject.title}
            </span>
            <span className="text-[11px] text-gray-500 shrink-0">
              {currentProject.aspectRatio} · {currentProject.resolution}
            </span>
          </div>
        ) : (
          <span className="text-sm text-gray-500">No project open</span>
        )}
      </div>

      {/* Right: API status + Export + Settings */}
      <div className="flex items-center gap-4">
        {/* API Status */}
        <div className="flex items-center gap-2 px-3 py-1 bg-gray-700 rounded-full text-xs cursor-pointer hover:bg-gray-600 transition">
          <div
            className={`w-2 h-2 rounded-full ${
              apiStatus === "connected"
                ? "bg-green-500 animate-pulse"
                : apiStatus === "checking"
                  ? "bg-yellow-500 animate-pulse"
                  : "bg-red-500"
            }`}
          />
          <span
            className={
              apiStatus === "connected"
                ? "text-green-400"
                : apiStatus === "checking"
                  ? "text-yellow-400"
                  : "text-red-400"
            }
          >
            {apiStatus === "connected"
              ? "API Connected"
              : apiStatus === "checking"
                ? "Checking..."
                : "API Disconnected"}
          </span>
        </div>

        {/* Export error */}
        {exportError && (
          <span className="text-[11px] text-rose-400">{exportError}</span>
        )}

        {/* Export / Download button */}
        {currentProject && showDownload ? (
          <a
            href={`/api/projects/${currentProject.id}/exports/${exportFilename}`}
            download
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400 transition-all hover:bg-emerald-500/20 hover:text-emerald-300 no-underline"
          >
            <Download className="h-3.5 w-3.5" />
            Download {exportFilename}
          </a>
        ) : currentProject ? (
          <button
            onClick={handleExportClick}
            disabled={isExporting}
            className={`flex items-center gap-2 px-4 py-1.5 rounded text-sm font-medium transition shadow-lg ${
              isExporting
                ? "bg-blue-600/20 text-blue-400 animate-pulse cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/50"
            }`}
          >
            <ArrowUpFromLine className="h-4 w-4" />
            {isExporting ? `Exporting... ${exportProgress}%` : "Export Video"}
          </button>
        ) : null}

        {/* Settings */}
        <button
          onClick={() => setShowApiSettings(true)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-all hover:text-gray-200 hover:bg-gray-700 active:bg-gray-600"
          title="API Settings"
        >
          <Settings className="h-4 w-4" />
        </button>
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
