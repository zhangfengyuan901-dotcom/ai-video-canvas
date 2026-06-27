// =========================================================================
// SceneVideoPanel -- Individual scene video version panel (redesigned)
// Display current video, generate video, switch versions
// =========================================================================

import { useState, useEffect } from "react";
import { useProjectStore } from "../../stores/projectStore";
import { useApi } from "../../hooks/useApi";
import { useVideoClips } from "../../hooks/useVideoClips";
import StatusBadge from "../ui/StatusBadge";
import GradientButton from "../ui/GradientButton";
import ClipDiagnosticsPanel from "./ClipDiagnosticsPanel";
import ClipDiagnosticsDrawer from "./ClipDiagnosticsDrawer";
import { Play, RefreshCw, AlertCircle, FileWarning, Video as VideoIcon, Bug } from "lucide-react";

interface SceneVideoPanelProps {
  sceneId: string;
}

export default function SceneVideoPanel({ sceneId }: SceneVideoPanelProps) {
  var { get, patch } = useApi();
  var { fetchClips, getCurrentClip, selectVersion, retryFailedClip } = useVideoClips();
  var currentProject = useProjectStore(function (s) { return s.currentProject; });
  var isGeneratingVideo = useProjectStore(function (s) { return s.isGeneratingVideo; });
  var clipsByScene = useProjectStore(function (s) { return s.clipsByScene; });

  var [localJobId, setLocalJobId] = useState<string | null>(null);
  var [localJobProgress, setLocalJobProgress] = useState(0);
  var [diagnosticsDrawerOpen, setDiagnosticsDrawerOpen] = useState(false);
  var [localRetryJobId, setLocalRetryJobId] = useState<string | null>(null);
  var [retryingClipId, setRetryingClipId] = useState<string | null>(null);

  var allClips = clipsByScene[sceneId] ?? [];
  var currentClip = getCurrentClip(sceneId);

  // Load clips on mount
  useEffect(function () { fetchClips(); }, [fetchClips]);

  // Poll local job
  useEffect(function () {
    if (!localJobId || !currentProject) return;
    var poll = setInterval(async function () {
      try {
        var job = await get<{ status: string; progress: number; error?: string }>(`/jobs/${localJobId}`);
        setLocalJobProgress(job.progress);
        if (job.status === "success") {
          setLocalJobId(null);
          useProjectStore.getState().setGeneratingVideo(false);
          await fetchClips();
        } else if (job.status === "failed" || job.status === "cancelled") {
          setLocalJobId(null);
          useProjectStore.getState().setGeneratingVideo(false);
        }
      } catch {
        setLocalJobId(null);
        useProjectStore.getState().setGeneratingVideo(false);
      }
    }, 2000);
    return function () { clearInterval(poll); };
 }, [localJobId, currentProject?.id, get, fetchClips]);

  // Poll local retry job
  useEffect(function () {
    if (!localRetryJobId || !currentProject) return;
    var poll = setInterval(async function () {
      try {
        var job = await get<{ status: string; progress: number; error?: string }>(`/jobs/${localRetryJobId}`);
        if (job.status === "success") {
          setLocalRetryJobId(null);
          await fetchClips();
        } else if (job.status === "failed") {
          setLocalRetryJobId(null);
          console.error("Retry job failed:", job.error ?? "unknown error");
          await fetchClips();
        } else if (job.status === "cancelled") {
          setLocalRetryJobId(null);
          console.error("Retry job cancelled");
          await fetchClips();
        }
      } catch (err) {
        setLocalRetryJobId(null);
        console.error("Retry job polling error:", err);
        await fetchClips();
      }
    }, 2000);
    return function () { clearInterval(poll); };
  }, [localRetryJobId, currentProject?.id, get, fetchClips]);

  // Generate video for this scene
  async function handleGenerate() {
    if (!currentProject || isGeneratingVideo) return;
    useProjectStore.getState().setGeneratingVideo(true);
    setLocalJobProgress(0);
    try {
      var res = await fetch(`/api/projects/${currentProject.id}/videos/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sceneIds: [sceneId] }),
      });
      var json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Generatefailed");
      setLocalJobId(json.data.jobId);
    } catch (err) {
      console.error("Video generation failed:", err);
      useProjectStore.getState().setGeneratingVideo(false);
    }
  }

  // Retry a failed clip
  async function handleRetryFailedClip(clipId: string, retryReason?: string) {
    if (!currentProject || isGeneratingVideo || retryingClipId) return;

    setRetryingClipId(clipId);
    try {
      var result = await retryFailedClip(sceneId, clipId, retryReason);
      if (result?.jobId) {
        setLocalRetryJobId(result.jobId);
      }
    } catch (err) {
      console.error("Video retry failed:", err);
    } finally {
      await fetchClips();
      setRetryingClipId(null);
    }
  }

  // Switch to next ready version
  async function handleSwitchVersion() {
    var readyClips = allClips.filter(function (c) { return c.status === "ready"; });
    if (readyClips.length < 2 || !currentClip) return;
    var currentIdx = readyClips.findIndex((c) => c.id === currentClip!.id);
    var next = readyClips[(currentIdx + 1) % readyClips.length];
    try {
      var data = await selectVersion(sceneId, next.id);
      if (data) {
        // Rebuild selectedClipId -- handled by fetchClips inside selectVersion
      }
    } catch (err) {
      console.error("Switch version failed:", err);
    }
  }

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-zinc-400 tracking-wide">视频</span>
        <div className="flex-1" />
        {currentClip && (
          <button
            onClick={function (e) { e.stopPropagation(); setDiagnosticsDrawerOpen(true); }}
            className="inline-flex items-center gap-1 rounded-lg border border-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 transition-all hover:bg-white/[0.04] hover:text-zinc-300"
          >
            <Bug className="h-3 w-3" />
            Troubleshoot
          </button>
        )}
        <button
          onClick={function (e) { e.stopPropagation(); fetchClips(); }}
          className="inline-flex items-center gap-1 rounded-lg border border-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 transition-all hover:bg-white/[0.04] hover:text-zinc-300"
        >
          <RefreshCw className="h-3 w-3" />
          Refresh
        </button>
        <button
          onClick={function (e) { e.stopPropagation(); handleGenerate(); }}
          disabled={isGeneratingVideo || !currentProject}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-medium transition-all ${
            isGeneratingVideo
              ? "bg-blue-600/20 text-blue-400 animate-pulse cursor-not-allowed"
              : "bg-gradient-to-b from-blue-500 to-blue-600 text-white shadow-sm shadow-blue-500/20 hover:from-blue-400 hover:to-blue-500 disabled:opacity-40 disabled:pointer-events-none"
          }`}
        >
          <VideoIcon className="h-3 w-3" />
          {isGeneratingVideo ? `生成中... ${localJobProgress}%` : currentClip ? "重生" : "生成"}
        </button>
      </div>

      {/* Review Status & Actions */}
      {currentClip && currentClip.status === "ready" && (
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={currentClip.reviewStatus === "approved" ? "approved" : currentClip.reviewStatus === "rejected" ? "rejected" : "waiting"} />
          {currentClip.reviewStatus !== "approved" && (
            <>
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  try {
                    await patch(`/projects/${currentProject!.id}/scenes/${sceneId}/videos/${currentClip!.id}/review`, { status: "approved", setCurrent: true });
                    await fetchClips();
                  } catch (err) {
                    console.error("Video approve failed:", err);
                  }
                }}
                className="inline-flex items-center gap-1 rounded-md bg-emerald-600/80 hover:bg-emerald-600 text-white px-2 py-1 text-[10px] font-medium transition-colors"
              >
                通过并设为当前版本
              </button>
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  try {
                    await patch(`/projects/${currentProject!.id}/scenes/${sceneId}/videos/${currentClip!.id}/review`, { status: "rejected", note: "用户驳回" });
                    await fetchClips();
                  } catch (err) {
                    console.error("Video reject failed:", err);
                  }
                }}
                className="inline-flex items-center gap-1 rounded-md bg-rose-600/80 hover:bg-rose-600 text-white px-2 py-1 text-[10px] font-medium transition-colors"
              >
                驳回此版本
              </button>
            </>
          )}
        </div>
      )}

      {/* Content */}
      {currentClip && currentClip.status === "ready" ? (
        <div>
          <div className="relative rounded-lg overflow-hidden bg-black ring-1 ring-white/[0.06]">
            <video
              src={`/api/projects/${currentProject?.id}/scenes/${sceneId}/videos/${currentClip.id}/video`}
              className="w-full aspect-video object-cover"
              controls
              preload="metadata"
              onClick={function (e) { e.stopPropagation(); }}
            />
          </div>
          <div className="flex items-center gap-2 mt-2">
            <StatusBadge status="ready" label={`v${currentClip.version}`} />
            {allClips.filter(function (c) { return c.status === "ready"; }).length > 1 && (
              <button
                onClick={function (e) { e.stopPropagation(); handleSwitchVersion(); }}
                className="inline-flex items-center gap-1 rounded-md bg-white/[0.04] border border-white/[0.06] px-2 py-0.5 text-[10px] font-medium text-zinc-400 transition-all hover:bg-white/[0.08] hover:text-zinc-300"
              >
                <RefreshCw className="h-3 w-3" />
                Switch
              </button>
            )}
            <span className="text-[10px] text-zinc-600 ml-auto">{currentClip.duration}s</span>
          </div>
          <ClipDiagnosticsPanel clip={currentClip} onOpenDrawer={function () { setDiagnosticsDrawerOpen(true); }} />
        </div>
      ) : currentClip && currentClip.status === "running" ? (
        <div>
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <div className="relative h-8 w-8">
              <div className="absolute inset-0 rounded-full border-2 border-white/[0.06]" />
              <div className="absolute inset-0 rounded-full border-2 border-t-blue-500 animate-spin" />
            </div>
            <span className="text-xs text-blue-400">视频生成中...</span>
          </div>
          <ClipDiagnosticsPanel clip={currentClip} onOpenDrawer={function () { setDiagnosticsDrawerOpen(true); }} />
        </div>
      ) : currentClip && currentClip.status === "failed" ? (
        <div>
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-600/10">
              <AlertCircle className="h-5 w-5 text-rose-400" />
            </div>
            <span className="text-xs text-rose-400">生成失败</span>
            <span className="text-[10px] text-zinc-500 text-center max-w-[300px]">
              {currentClip.error ?? currentClip.diagnostics?.errorMessage ?? "未知错误"}
            </span>
          </div>
          <ClipDiagnosticsPanel clip={currentClip} onOpenDrawer={function () { setDiagnosticsDrawerOpen(true); }} />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-10 gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800/60">
            <VideoIcon className="h-5 w-5 text-zinc-500" />
          </div>
          <span className="text-xs text-zinc-600">暂无视频</span>
          <span className="text-[10px] text-zinc-600">点击「生成」按钮创建视频</span>
        </div>
      )}

      {/* Diagnostics Drawer */}
      <ClipDiagnosticsDrawer
        clip={currentClip}
        open={diagnosticsDrawerOpen}
        onClose={function () { setDiagnosticsDrawerOpen(false); }}
        onRegenerate={
    currentClip?.status === "failed"
      ? function () { handleRetryFailedClip(currentClip!.id, currentClip!.diagnostics?.errorMessage ?? currentClip!.error ?? undefined); }
      : undefined
  }
        isRegenerating={isGeneratingVideo || retryingClipId === currentClip?.id || !!localRetryJobId}
      />
    </div>
  );
}
