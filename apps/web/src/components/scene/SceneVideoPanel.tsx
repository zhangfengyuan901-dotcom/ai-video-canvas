// =========================================================================
// SceneVideoPanel — 单个镜头的视频版本区
// 展示当前视频、生成视频、切换版本
// =========================================================================

import { useState, useEffect } from "react";
import { useProjectStore } from "../../stores/projectStore";
import { useApi } from "../../hooks/useApi";
import { useVideoClips } from "../../hooks/useVideoClips";
import ClipDiagnosticsPanel from "./ClipDiagnosticsPanel";
import ClipDiagnosticsDrawer from "./ClipDiagnosticsDrawer";

interface SceneVideoPanelProps {
  sceneId: string;
}

export default function SceneVideoPanel({ sceneId }: SceneVideoPanelProps) {
  var { get } = useApi();
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
      if (!json.success) throw new Error(json.error ?? "生成视频失败");
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
        // Rebuild selectedClipId — handled by fetchClips inside selectVersion
        // The store's clipsByScene is already updated
      }
    } catch (err) {
      console.error("Switch version failed:", err);
    }
  }

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 space-y-2">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-zinc-400">视频版本</span>
        <div className="flex-1" />
        {currentClip && (
          <button
            onClick={function (e) { e.stopPropagation(); setDiagnosticsDrawerOpen(true); }}
            className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            排障详情
          </button>
        )}
        <button
          onClick={function (e) { e.stopPropagation(); fetchClips(); }}
          className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          刷新
        </button>
        <button
          onClick={function (e) { e.stopPropagation(); handleGenerate(); }}
          disabled={isGeneratingVideo || !currentProject}
          className="text-[10px] bg-blue-600 hover:bg-blue-500 text-white px-2 py-0.5 rounded font-medium transition-colors disabled:bg-zinc-700 disabled:text-zinc-500"
        >
          {isGeneratingVideo ? `生成中... ${localJobProgress}%` : currentClip ? "重新生成" : "生成视频"}
        </button>
      </div>

      {/* Content */}
      {currentClip && currentClip.status === "ready" ? (
        <div>
          <video
            src={`/api/projects/${currentProject?.id}/scenes/${sceneId}/videos/${currentClip.id}/video`}
            className="w-full aspect-video rounded bg-black object-cover"
            controls
            preload="metadata"
            onClick={function (e) { e.stopPropagation(); }}
          />
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[10px] text-zinc-500">当前版本 v{currentClip.version}</span>
            {allClips.filter(function (c) { return c.status === "ready"; }).length > 1 && (
              <button
                onClick={function (e) { e.stopPropagation(); handleSwitchVersion(); }}
                className="text-[10px] bg-zinc-700 hover:bg-zinc-600 text-zinc-300 px-1.5 py-0.5 rounded transition-colors"
              >
                切换版本
              </button>
            )}
            <span className="text-[10px] text-zinc-600 ml-auto">{currentClip.duration}s</span>
          </div>
          <ClipDiagnosticsPanel clip={currentClip} onOpenDrawer={function () { setDiagnosticsDrawerOpen(true); }} />
        </div>
      ) : currentClip && currentClip.status === "running" ? (
        <div>
          <div className="flex items-center justify-center py-8">
            <span className="text-xs text-blue-400 animate-pulse">视频生成中...</span>
          </div>
          <ClipDiagnosticsPanel clip={currentClip} onOpenDrawer={function () { setDiagnosticsDrawerOpen(true); }} />
        </div>
      ) : currentClip && currentClip.status === "failed" ? (
        <div>
          <div className="flex items-center justify-center py-8">
            <span className="text-xs text-red-400">
              视频生成失败: {currentClip.error ?? currentClip.diagnostics?.errorMessage ?? "未知错误"}
            </span>
          </div>
          <ClipDiagnosticsPanel clip={currentClip} onOpenDrawer={function () { setDiagnosticsDrawerOpen(true); }} />
        </div>
      ) : (
        <div className="flex items-center justify-center py-8">
          <span className="text-xs text-zinc-600">还没有视频，先生成该镜头视频</span>
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
