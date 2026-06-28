// =========================================================================
// ProjectProgressPanel — 项目进度与下一步引导 (redesigned)
// 汇总脚本/三图/视频完成度，提供批量生成缺失三图/视频的快捷动作
// =========================================================================

import { useState, useEffect, useCallback } from "react";
import { useApi } from "../../hooks/useApi";
import { useVideoClips } from "../../hooks/useVideoClips";
import { useProjectStore } from "../../stores/projectStore";
import GlassPanel from "../ui/GlassPanel";
import SectionHeader from "../ui/SectionHeader";
import BentoCard from "../ui/BentoCard";
import SoftDivider from "../ui/SoftDivider";
import type { StoryboardPanel } from "@ai-video-canvas/shared";
import { RefreshCw, ImagePlus, Video, AlertTriangle } from "lucide-react";

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
    <GlassPanel className="p-4 space-y-4">
      <SectionHeader
        title="项目进度"
        action={
          <button
            onClick={(e) => { e.stopPropagation(); refreshProgress(); }}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-700 px-2 py-1 text-[10px] font-medium text-gray-500 transition-all hover:bg-gray-700 hover:text-gray-300"
          >
            <RefreshCw className="h-3 w-3" />
            刷新
          </button>
        }
      />

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-xs text-rose-400 bg-rose-600/10 border border-rose-500/10 rounded-xl px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-3">
        <BentoCard
          label="脚本"
          value={sceneCount > 0 ? `${sceneCount} 个镜头` : "0 个镜头"}
          accent={sceneCount > 0}
        />
        <BentoCard
          label="三图素材"
          value={sceneCount > 0 ? `${storyboardReadySceneIds.length} / ${sceneCount}` : "0 / 0"}
          accent={sceneCount > 0 && storyboardReadySceneIds.length === sceneCount}
        />
        <BentoCard
          label="视频片段"
          value={sceneCount > 0 ? `${videoReadySceneIds.length} / ${sceneCount}` : "0 / 0"}
          accent={sceneCount > 0 && videoReadySceneIds.length === sceneCount}
        />
        <BentoCard
          label="导出状态"
          value={canExport ? "可导出" : "未完成"}
          accent={canExport}
        />
      </div>

      {/* Loading indicator for panels */}
      {loadingPanels && (
        <p className="text-[10px] text-gray-500 animate-pulse">正在加载素材状态...</p>
      )}

      <SoftDivider />

      {/* Next action */}
      <div className="rounded-xl bg-gray-800 border border-gray-700 p-4 space-y-3">
        {nextAction === "create_script" && (
          <>
            <p className="text-xs text-gray-400">下一步：在左侧输入创意，生成视频脚本。</p>
          </>
        )}

        {nextAction === "generate_missing_storyboards" && (
          <>
            <p className="text-xs text-gray-400">
              还有 <span className="text-amber-400 font-medium">{missingStoryboardSceneIds.length}</span> 个镜头缺少三图素材
            </p>
            <div className="flex gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); handleGenerateMissingStoryboards(); }}
                disabled={isGeneratingStoryboard}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 text-white px-3 py-1.5 text-xs font-medium transition-all hover:bg-amber-500 active:bg-amber-700 disabled:opacity-40 disabled:pointer-events-none"
              >
                <ImagePlus className="h-3.5 w-3.5" />
                {isGeneratingStoryboard && storyboardJobId
                  ? `生成中... ${storyboardJobProgress}%`
                  : `生成缺失三图（${missingStoryboardSceneIds.length}）`}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleGenerateAllStoryboards(); }}
                disabled={isGeneratingStoryboard}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-b from-blue-500 to-blue-600 text-white px-3 py-1.5 text-xs font-medium transition-all hover:from-blue-400 hover:to-blue-500 active:from-blue-600 active:to-blue-700 disabled:opacity-40 disabled:pointer-events-none shadow-sm shadow-blue-500/20"
              >
                <ImagePlus className="h-3.5 w-3.5" />
                {isGeneratingStoryboard && storyboardJobId
                  ? `生成中... ${storyboardJobProgress}%`
                  : "生成全部故事板"}
              </button>
            </div>
          </>
        )}

        {nextAction === "generate_missing_videos" && (
          <>
            <p className="text-xs text-gray-400">
              三图素材已完成，还有 <span className="text-blue-400 font-medium">{missingVideoSceneIds.length}</span> 个镜头缺少视频
            </p>
            <div className="flex gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); handleGenerateMissingVideos(); }}
                disabled={isGeneratingVideo}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 text-white px-3 py-1.5 text-xs font-medium transition-all hover:bg-blue-500 active:bg-blue-700 disabled:opacity-40 disabled:pointer-events-none"
              >
                <Video className="h-3.5 w-3.5" />
                {isGeneratingVideo && videoJobId
                  ? `生成中... ${videoJobProgress}%`
                  : `生成缺失视频（${missingVideoSceneIds.length}）`}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleGenerateAllVideos(); }}
                disabled={isGeneratingVideo}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-b from-violet-500 to-violet-600 text-white px-3 py-1.5 text-xs font-medium transition-all hover:from-violet-400 hover:to-violet-500 active:from-violet-600 active:to-violet-700 disabled:opacity-40 disabled:pointer-events-none shadow-sm shadow-violet-500/20"
              >
                <Video className="h-3.5 w-3.5" />
                {isGeneratingVideo && videoJobId
                  ? `生成中... ${videoJobProgress}%`
                  : "生成全部视频"}
              </button>
            </div>
          </>
        )}

        {nextAction === "ready_to_export" && (
          <>
            <p className="text-xs text-emerald-400">全部镜头视频已完成，可以点击右上角「导出」导出完整视频。</p>
            <button
              onClick={(e) => { e.stopPropagation(); handleGenerateAllVideos(); }}
              disabled={isGeneratingVideo}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-b from-violet-500 to-violet-600 text-white px-3 py-1.5 text-xs font-medium transition-all hover:from-violet-400 hover:to-violet-500 active:from-violet-600 active:to-violet-700 disabled:opacity-40 disabled:pointer-events-none shadow-sm shadow-violet-500/20"
            >
              <Video className="h-3.5 w-3.5" />
              {isGeneratingVideo && videoJobId
                ? `生成中... ${videoJobProgress}%`
                : "重新生成全部视频"}
            </button>
          </>
        )}

        {failedVideoCount > 0 && (
          <p className="text-xs text-rose-400/70 pt-1">
            有 {failedVideoCount} 个镜头曾生成失败，可展开 SceneCard 查看并重试。
          </p>
        )}
      </div>
    </GlassPanel>
  );
}
