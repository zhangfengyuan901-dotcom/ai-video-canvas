// =========================================================================
// SceneVideoPanel 鈥?鍗曚釜闀滃ご鐨勮棰戠増鏈尯
// 灞曠ず褰撳墠瑙嗛銆佺敓鎴愯棰戙€佸垏鎹㈢増鏈?// =========================================================================

import { useState, useEffect, useCallback } from "react";
import { useProjectStore } from "../../stores/projectStore";
import { useApi } from "../../hooks/useApi";
import { useVideoClips } from "../../hooks/useVideoClips";
import ClipDiagnosticsPanel from "./ClipDiagnosticsPanel";

interface SceneVideoPanelProps {
  sceneId: string;
}

export default function SceneVideoPanel({ sceneId }: SceneVideoPanelProps) {
  const { get } = useApi();
  const { fetchClips, getCurrentClip, selectVersion } = useVideoClips();
  const currentProject = useProjectStore((s) => s.currentProject);
  const isGeneratingVideo = useProjectStore((s) => s.isGeneratingVideo);
  const clipsByScene = useProjectStore((s) => s.clipsByScene);

  const [localJobId, setLocalJobId] = useState<string | null>(null);
  const [localJobProgress, setLocalJobProgress] = useState<number>(0);

  const allClips = clipsByScene[sceneId] ?? [];
  const currentClip = getCurrentClip(sceneId);

  // Load clips on mount
  useEffect(() => {
    fetchClips();
  }, [fetchClips]);

  // Poll local job
  useEffect(() => {
    if (!localJobId || !currentProject) return;
    const poll = setInterval(async () => {
      try {
        const job = await get<{ status: string; progress: number; error?: string }>(`/jobs/${localJobId}`);
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
    return () => clearInterval(poll);
  }, [localJobId, currentProject?.id, get, fetchClips]);

  // Generate video for this scene
  async function handleGenerate() {
    if (!currentProject || isGeneratingVideo) return;
    useProjectStore.getState().setGeneratingVideo(true);
    setLocalJobProgress(0);
    try {
      const res = await fetch(`/api/projects/${currentProject.id}/videos/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sceneIds: [sceneId] }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "鐢熸垚瑙嗛澶辫触");
      setLocalJobId(json.data.jobId);
    } catch (err) {
      console.error("Video generation failed:", err);
      useProjectStore.getState().setGeneratingVideo(false);
    }
  }

  // Switch to next ready version
  async function handleSwitchVersion() {
    const readyClips = allClips.filter((c) => c.status === "ready");
    if (readyClips.length < 2 || !currentClip) return;
    const currentIdx = readyClips.findIndex((c) => c.id === currentClip.id);
    const next = readyClips[(currentIdx + 1) % readyClips.length];
    try {
      const data = await selectVersion(sceneId, next.id);
      if (data) {
        // Rebuild selectedClipId 鈥?handled by fetchClips inside selectVersion
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
        <span className="text-xs font-medium text-zinc-400">瑙嗛鐗堟湰</span>
        <div className="flex-1" />
        <button
          onClick={(e) => { e.stopPropagation(); fetchClips(); }}
          className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          鍒锋柊
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleGenerate(); }}
          disabled={isGeneratingVideo || !currentProject}
          className="text-[10px] bg-blue-600 hover:bg-blue-500 text-white px-2 py-0.5 rounded font-medium transition-colors disabled:bg-zinc-700 disabled:text-zinc-500"
        >
          {isGeneratingVideo ? `鐢熸垚涓?.. ${localJobProgress}%` : currentClip ? "閲嶆柊鐢熸垚" : "鐢熸垚瑙嗛"}
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
            onClick={(e) => e.stopPropagation()}
          />
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[10px] text-zinc-500">
              当前版本 v{currentClip.version}
            </span>
            {allClips.filter((c) => c.status === "ready").length > 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); handleSwitchVersion(); }}
                className="text-[10px] bg-zinc-700 hover:bg-zinc-600 text-zinc-300 px-1.5 py-0.5 rounded transition-colors"
              >
                切换版本
              </button>
            )}
            <span className="text-[10px] text-zinc-600 ml-auto">
              {currentClip.duration}s
            </span>
          </div>
          <ClipDiagnosticsPanel clip={currentClip} />
        </div>
      ) : currentClip && currentClip.status === "running" ? (
        <div>
          <div className="flex items-center justify-center py-8">
            <span className="text-xs text-blue-400 animate-pulse">视频生成中...</span>
          </div>
          <ClipDiagnosticsPanel clip={currentClip} />
        </div>
      ) : currentClip && currentClip.status === "failed" ? (
        <div>
          <div className="flex items-center justify-center py-8">
            <span className="text-xs text-red-400">
              视频生成失败: {currentClip.error ?? currentClip.diagnostics?.errorMessage ?? "未知错误"}
            </span>
          </div>
          <ClipDiagnosticsPanel clip={currentClip} />
        </div>
      ) : (
        <div className="flex items-center justify-center py-8">
          <span className="text-xs text-zinc-600">还没有视频，先生成该镜头视频</span>
        </div>
      )}
    </div>
  );
}
