// =========================================================================
// ProjectProgressPanel — 项目进度与下一步引导
// 汇总脚本/三图/视频完成度，提供批量生成缺失三图/视频的快捷动作
// =========================================================================

import { useState, useEffect, useCallback } from "react";
import { useApi } from "../../hooks/useApi";
import { useVideoClips } from "../../hooks/useVideoClips";
import { useProjectStore } from "../../stores/projectStore";
import type { StoryboardPanel } from "@ai-video-canvas/shared";

type NextAction =
  | "create_script"
  | "generate_missing_storyboards"
  | "generate_missing_videos"
  | "ready_to_export";

function isSceneStoryboardReady(sceneId: string, panelsByScene: Record<string, StoryboardPanel[]>) {
  const panels = panelsByScene[sceneId] ?? [];
  const readyIndexes = new Set(
    panels.filter((p) => p.status === "ready").map((p) => p.panelIndex),
  );
  return readyIndexes.has(0) && readyIndexes.has(1) && readyIndexes.has(2);
}

export default function ProjectProgressPanel() {
  const { get, post } = useApi();
  const { fetchClips, getCurrentClip } = useVideoClips();

  const currentProject = useProjectStore((s) => s.currentProject);
  const scenes = useProjectStore((s) => s.scenes);
  const clipsByScene = useProjectStore((s) => s.clipsByScene);
  const isGeneratingStoryboard = useProjectStore((s) => s.isGeneratingStoryboard);
  const isGeneratingVideo = useProjectStore((s) => s.isGeneratingVideo);
  const panelsByScene = useProjectStore((s) => s.panelsByScene);

  const [loadingPanels, setLoadingPanels] = useState(false);
  const [storyboardJobId, setStoryboardJobId] = useState<string | null>(null);
  const [storyboardJobProgress, setStoryboardJobProgress] = useState(0);
  const [videoJobId, setVideoJobId] = useState<string | null>(null);
  const [videoJobProgress, setVideoJobProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const sceneCount = scenes.length;

  // ---- Load all panels & clips on mount ----------------------------------

  const loadAllPanels = useCallback(async () => {
    if (!currentProject || scenes.length === 0) return;
    setLoadingPanels(true);
    try {
      await Promise.all(
        scenes.map(async (scene) => {
          const panels = await get<StoryboardPanel[]>(
            `/projects/${currentProject.id}/scenes/${scene.id}/panels`,
          );
          useProjectStore.getState().setPanels(scene.id, panels);
        }),
      );
    } catch (err) {
      console.error("Failed to load all panels:", err);
    } finally {
      setLoadingPanels(false);
    }
  }, [currentProject?.id, scenes.length, get]);

  useEffect(() => {
    if (currentProject && scenes.length > 0) {
      loadAllPanels();
      fetchClips();
    }
  }, [currentProject?.id, scenes.length, fetchClips, loadAllPanels]);

  // ---- Computed stats ----------------------------------------------------

  const storyboardReadySceneIds = scenes
    .filter((scene) => isSceneStoryboardReady(scene.id, panelsByScene))
    .map((scene) => scene.id);

  const missingStoryboardSceneIds = scenes
    .filter((scene) => !isSceneStoryboardReady(scene.id, panelsByScene))
    .map((scene) => scene.id);

  const videoReadySceneIds = scenes
    .filter((scene) => getCurrentClip(scene.id)?.status === "ready")
    .map((scene) => scene.id);

  const missingVideoSceneIds = scenes
    .filter((scene) => {
      const sbReady = isSceneStoryboardReady(scene.id, panelsByScene);
      const vReady = getCurrentClip(scene.id)?.status === "ready";
      return sbReady && !vReady;
    })
    .map((scene) => scene.id);

  const failedVideoCount = scenes.filter((scene) => {
    const clips = clipsByScene[scene.id] ?? [];
    return clips.some((clip) => clip.status === "failed");
  }).length;

  const canExport = sceneCount > 0 && videoReadySceneIds.length === sceneCount;

  // ---- Next action -------------------------------------------------------

  let nextAction: NextAction = "create_script";
  if (sceneCount === 0) {
    nextAction = "create_script";
  } else if (missingStoryboardSceneIds.length > 0) {
    nextAction = "generate_missing_storyboards";
  } else if (missingVideoSceneIds.length > 0) {
    nextAction = "generate_missing_videos";
  } else {
    nextAction = "ready_to_export";
  }

  // ---- Refresh -----------------------------------------------------------

  async function refreshProgress() {
    await Promise.all([loadAllPanels(), fetchClips()]);
    setError(null);
  }

  // ---- Generate missing storyboards --------------------------------------

  async function handleGenerateMissingStoryboards() {
    if (!currentProject || missingStoryboardSceneIds.length === 0) return;
    if (isGeneratingStoryboard) return;
    setError(null);
    useProjectStore.getState().setGeneratingStoryboard(true);
    setStoryboardJobProgress(0);
    try {
      const data = await post<{ jobId: string }>(
        `/projects/${currentProject.id}/storyboard/generate`,
        { sceneIds: missingStoryboardSceneIds },
      );
      setStoryboardJobId(data.jobId);
    } catch (err) {
      console.error("Generate missing storyboards failed:", err);
      useProjectStore.getState().setGeneratingStoryboard(false);
      setError("生成失败，请展开对应镜头查看详情或重试。");
    }
  }

  // ---- Generate all storyboards (batch) ----------------------------------

  async function handleGenerateAllStoryboards() {
    if (!currentProject || isGeneratingStoryboard) return;
    setError(null);
    useProjectStore.getState().setGeneratingStoryboard(true);
    setStoryboardJobProgress(0);
    try {
      const data = await post<{ jobId: string }>(
        `/projects/${currentProject.id}/storyboard/generate`,
        {},
      );
      setStoryboardJobId(data.jobId);
    } catch (err) {
      console.error("Generate all storyboards failed:", err);
      useProjectStore.getState().setGeneratingStoryboard(false);
      setError("生成失败。");
    }
  }

  // ---- Generate all videos (batch) ----------------------------------------

  async function handleGenerateAllVideos() {
    if (!currentProject || isGeneratingVideo) return;
    // Only generate for approved storyboards without ready video
    const approvedScenes = scenes
      .filter((s) => s.storyboardReviewStatus === "approved")
      .filter((s) => getCurrentClip(s.id)?.status !== "ready" && getCurrentClip(s.id)?.status !== "running")
      .map((s) => s.id);
    if (approvedScenes.length === 0) {
      setError("没有可生成的视频，请先审核通过故事板。");
      return;
    }
    setError(null);
    useProjectStore.getState().setGeneratingVideo(true);
    setVideoJobProgress(0);
    try {
      const data = await post<{ jobId: string }>(
        `/projects/${currentProject.id}/videos/generate`,
        { sceneIds: approvedScenes },
      );
      setVideoJobId(data.jobId);
    } catch (err) {
      console.error("Generate all videos failed:", err);
      useProjectStore.getState().setGeneratingVideo(false);
      setError("生成失败。");
    }
  }

  // ---- Generate missing videos -------------------------------------------

  async function handleGenerateMissingVideos() {
    if (!currentProject || missingVideoSceneIds.length === 0) return;
    if (isGeneratingVideo) return;
    setError(null);
    useProjectStore.getState().setGeneratingVideo(true);
    setVideoJobProgress(0);
    try {
      const data = await post<{ jobId: string }>(
        `/projects/${currentProject.id}/videos/generate`,
        { sceneIds: missingVideoSceneIds },
      );
      setVideoJobId(data.jobId);
    } catch (err) {
      console.error("Generate missing videos failed:", err);
      useProjectStore.getState().setGeneratingVideo(false);
      setError("生成失败，请展开对应镜头查看详情或重试。");
    }
  }

  // ---- Poll storyboard job -----------------------------------------------

  useEffect(() => {
    if (!storyboardJobId) return;
    const poll = setInterval(async () => {
      try {
        const job = await get<{ status: string; progress: number; error?: string }>(`/jobs/${storyboardJobId}`);
        setStoryboardJobProgress(job.progress);
        if (job.status === "success") {
          setStoryboardJobId(null);
          useProjectStore.getState().setGeneratingStoryboard(false);
          await loadAllPanels();
        } else if (job.status === "failed" || job.status === "cancelled") {
          setStoryboardJobId(null);
          useProjectStore.getState().setGeneratingStoryboard(false);
          setError("生成失败，请展开对应镜头查看详情或重试。");
        }
      } catch {
        setStoryboardJobId(null);
        useProjectStore.getState().setGeneratingStoryboard(false);
      }
    }, 2000);
    return () => clearInterval(poll);
  }, [storyboardJobId, loadAllPanels, get]);

  // ---- Poll video job ----------------------------------------------------

  useEffect(() => {
    if (!videoJobId) return;
    const poll = setInterval(async () => {
      try {
        const job = await get<{ status: string; progress: number; error?: string }>(`/jobs/${videoJobId}`);
        setVideoJobProgress(job.progress);
        if (job.status === "success") {
          setVideoJobId(null);
          useProjectStore.getState().setGeneratingVideo(false);
          await fetchClips();
        } else if (job.status === "failed" || job.status === "cancelled") {
          setVideoJobId(null);
          useProjectStore.getState().setGeneratingVideo(false);
          setError("生成失败，请展开对应镜头查看详情或重试。");
        }
      } catch {
        setVideoJobId(null);
        useProjectStore.getState().setGeneratingVideo(false);
      }
    }, 2000);
    return () => clearInterval(poll);
  }, [videoJobId, fetchClips, get]);

  // ---- Render ------------------------------------------------------------

  if (!currentProject) {
    return null;
  }

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-zinc-300">项目进度</span>
        <div className="flex-1" />
        <button
          onClick={(e) => { e.stopPropagation(); refreshProgress(); }}
          className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          刷新状态
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="text-xs text-red-400 bg-red-600/10 rounded px-3 py-2">{error}</div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-2">
        <StatCard label="脚本" value={sceneCount > 0 ? `${sceneCount} 个镜头` : "0 个镜头"} done={sceneCount > 0} />
        <StatCard
          label="三图素材"
          value={sceneCount > 0 ? `${storyboardReadySceneIds.length} / ${sceneCount}` : "0 / 0"}
          done={sceneCount > 0 && storyboardReadySceneIds.length === sceneCount}
        />
        <StatCard
          label="视频片段"
          value={sceneCount > 0 ? `${videoReadySceneIds.length} / ${sceneCount}` : "0 / 0"}
          done={sceneCount > 0 && videoReadySceneIds.length === sceneCount}
        />
        <StatCard
          label="导出状态"
          value={canExport ? "可导出" : "未完成"}
          done={canExport}
        />
      </div>

      {/* Next action */}
      <div className="rounded bg-zinc-950/60 p-3 space-y-2">
        {nextAction === "create_script" && (
          <p className="text-xs text-zinc-400">下一步：在左侧输入创意，生成视频脚本。</p>
        )}

        {nextAction === "generate_missing_storyboards" && (
          <>
            <p className="text-xs text-zinc-400">
              下一步：还有 {missingStoryboardSceneIds.length} 个镜头缺少三图素材，建议先生成缺失三图。
            </p>
            <div className="flex gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); handleGenerateMissingStoryboards(); }}
                disabled={isGeneratingStoryboard}
                className="text-xs bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded font-medium transition-colors disabled:bg-zinc-700 disabled:text-zinc-500"
              >
                {isGeneratingStoryboard && storyboardJobId
                  ? `生成中... ${storyboardJobProgress}%`
                  : `生成缺失三图（${missingStoryboardSceneIds.length}）`}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleGenerateAllStoryboards(); }}
                disabled={isGeneratingStoryboard}
                className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded font-medium transition-colors disabled:bg-zinc-700 disabled:text-zinc-500"
              >
                {isGeneratingStoryboard && storyboardJobId
                  ? `生成中... ${storyboardJobProgress}%`
                  : "生成全部故事板"}
              </button>
            </div>
          </>
        )}

        {nextAction === "generate_missing_videos" && (
          <>
            <p className="text-xs text-zinc-400">
              下一步：三图素材已完成，还有 {missingVideoSceneIds.length} 个镜头缺少视频，建议生成缺失视频。
            </p>
            <div className="flex gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); handleGenerateMissingVideos(); }}
                disabled={isGeneratingVideo}
                className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded font-medium transition-colors disabled:bg-zinc-700 disabled:text-zinc-500"
              >
                {isGeneratingVideo && videoJobId
                  ? `生成中... ${videoJobProgress}%`
                  : `生成缺失视频（${missingVideoSceneIds.length}）`}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleGenerateAllVideos(); }}
                disabled={isGeneratingVideo}
                className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded font-medium transition-colors disabled:bg-zinc-700 disabled:text-zinc-500"
              >
                {isGeneratingVideo && videoJobId
                  ? `生成中... ${videoJobProgress}%`
                  : "生成全部视频"}
              </button>
            </div>
          </>
        )}

        {nextAction === "ready_to_export" && (
          <>
            <p className="text-xs text-green-400">
              全部镜头视频已完成，可以点击右上角"导出完整视频"。
            </p>
            <button
              onClick={(e) => { e.stopPropagation(); handleGenerateAllVideos(); }}
              disabled={isGeneratingVideo}
              className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded font-medium transition-colors disabled:bg-zinc-700 disabled:text-zinc-500"
            >
              {isGeneratingVideo && videoJobId
                ? `生成中... ${videoJobProgress}%`
                : "重新生成全部视频"}
            </button>
          </>
        )}

        {failedVideoCount > 0 && (
          <p className="text-xs text-red-400/70 pt-1">
            有 {failedVideoCount} 个镜头曾生成失败，可展开 SceneCard 查看并重试。
          </p>
        )}
      </div>

      {/* Loading indicator for panels */}
      {loadingPanels && (
        <p className="text-[10px] text-zinc-500 animate-pulse">正在加载素材状态...</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat card sub-component
// ---------------------------------------------------------------------------

function StatCard({ label, value, done }: { label: string; value: string; done: boolean }) {
  const colorCls = done ? "text-green-400" : "text-zinc-400";
  return (
    <div className="rounded border border-zinc-800 bg-zinc-950/40 p-2.5">
      <div className="text-[10px] text-zinc-500 mb-0.5">{label}</div>
      <div className={`text-sm font-medium ${colorCls}`}>{value}</div>
    </div>
  );
}
