// =========================================================================
// TimelineTrack — 单条时间线轨道（Storyboard / Video）
// 支持拖拽排序 + 视频生成管理（Phase 4）
// =========================================================================

import { useState, useRef, useCallback, useEffect } from "react";
import { useProjectStore } from "../../stores/projectStore";
import { useApi } from "../../hooks/useApi";
import TimelineItem from "./TimelineItem";

interface TimelineTrackProps {
  label: string;
  type: "storyboard" | "video";
}

export default function TimelineTrack({ label, type }: TimelineTrackProps) {
  const scenes = useProjectStore((s) => s.scenes);
  const panelsByScene = useProjectStore((s) => s.panelsByScene);
  const clipsByScene = useProjectStore((s) => s.clipsByScene);
  const currentProject = useProjectStore((s) => s.currentProject);
  const selectedSceneId = useProjectStore((s) => s.selectedSceneId);
  const selectScene = useProjectStore((s) => s.selectScene);
  const reorderScenes = useProjectStore((s) => s.reorderScenes);
  const isGeneratingVideo = useProjectStore((s) => s.isGeneratingVideo);
  const { post, get } = useApi();

  const [selectedClipId, setSelectedClipId] = useState<Record<string, string>>({});
  const [videoJobId, setVideoJobId] = useState<string | null>(null);
  const [videoJobProgress, setVideoJobProgress] = useState<number>(0);
  const dragIdRef = useRef<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // ---- Video: fetch clips (stable callback via getState) ----------------

  const fetchClips = useCallback(async () => {
    const project = useProjectStore.getState().currentProject;
    if (!project) return;
    try {
      const data = await get<any[]>(`/projects/${project.id}/videos`);
      useProjectStore.getState().setAllClips(data as any);
      // 从 isCurrent 标记初始化选中版本（持久化）
      const currentIds: Record<string, string> = {};
      for (const clip of data) {
        if (clip.isCurrent) {
          currentIds[clip.sceneId] = clip.id;
        }
      }
      setSelectedClipId(currentIds);
    } catch {
      // silent
    }
  }, [get]);

  // Fetch on mount / project id change
  useEffect(() => {
    if (type === "video" && currentProject) {
      fetchClips();
    }
  }, [type, currentProject?.id, fetchClips]);

  // Auto-poll every 5s
  useEffect(() => {
    if (type !== "video" || !currentProject) return;
    const id = setInterval(fetchClips, 5000);
    return () => clearInterval(id);
  }, [type, currentProject?.id, fetchClips]);

  // ---- Video: poll job when a VIDEO_GENERATE job is running ----------

  useEffect(() => {
    if (!videoJobId || !currentProject) return;
    const poll = setInterval(async () => {
      try {
        const job = await get<{ status: string; progress: number; error?: string }>(`/jobs/${videoJobId}`);
        setVideoJobProgress(job.progress);
        if (job.status === "success") {
          setVideoJobId(null);
          useProjectStore.getState().setGeneratingVideo(false);
          fetchClips();
        } else if (job.status === "failed") {
          setVideoJobId(null);
          console.error("Video job failed:", job.error);
          useProjectStore.getState().setGeneratingVideo(false);
        } else if (job.status === "cancelled") {
          setVideoJobId(null);
          useProjectStore.getState().setGeneratingVideo(false);
        }
      } catch {
        setVideoJobId(null);
        useProjectStore.getState().setGeneratingVideo(false);
      }
    }, 2000);
    return () => clearInterval(poll);
  }, [videoJobId, currentProject?.id, get, fetchClips]);

  // ---- Video: restore running job on page refresh --------------------

  useEffect(() => {
    if (!currentProject) return;
    (async () => {
      try {
        const jobs = await get<any[]>(`/projects/${currentProject.id}/jobs`);
        const runningJob = jobs.find(
          (j) => j.type === "VIDEO_GENERATE" && (j.status === "queued" || j.status === "running"),
        );
        if (runningJob && runningJob.id !== videoJobId) {
          setVideoJobId(runningJob.id);
          setVideoJobProgress(runningJob.progress ?? 0);
          useProjectStore.getState().setGeneratingVideo(true);
        }
      } catch { /* silent */ }
    })();
  }, [currentProject?.id, videoJobId, get]);

  // ---- Video: generate --------------------------------------------------

  const handleGenerateVideo = useCallback(
    async (sceneIds?: string[]) => {
      const project = useProjectStore.getState().currentProject;
      if (!project || useProjectStore.getState().isGeneratingVideo) return;
      useProjectStore.getState().setGeneratingVideo(true);
      setVideoJobProgress(0);
      try {
        const ids = sceneIds ?? useProjectStore.getState().scenes.map((s) => s.id);
        const data = await post<{ jobId: string }>(`/projects/${project.id}/videos/generate`, { sceneIds: ids });
        setVideoJobId(data.jobId);
      } catch (err) {
        console.error("Video generation failed:", err);
        useProjectStore.getState().setGeneratingVideo(false);
      }
    },
    [post],
  );

  // ---- Helpers ----------------------------------------------------------

  function getThumbnailUrl(sceneId: string): string | null {
    const projectId = useProjectStore.getState().currentProject?.id;
    if (!projectId) return null;
    // 优先使用三宫格 strip，否则 fallback 到第一张 panel
    return `/api/projects/${projectId}/scenes/${sceneId}/strip`;
  }

  function getClip(sceneId: string) {
    const clips = clipsByScene[sceneId];
    if (!clips || clips.length === 0) return null;
    // 如果用户选择了某个版本，优先显示
    const overrideId = selectedClipId[sceneId];
    if (overrideId) {
      const override = clips.find((c) => c.id === overrideId);
      if (override) return override;
    }
    // 否则显示最新版本
    return clips.reduce((latest, c) => (c.version > latest.version ? c : latest), clips[0]);
  }

  async function handleSelectVersion(sceneId: string, clipId: string) {
    const project = useProjectStore.getState().currentProject;
    if (!project) return;

    // 乐观更新，让用户立即看到切换
    setSelectedClipId((prev) => ({ ...prev, [sceneId]: clipId }));

    try {
      await post(`/projects/${project.id}/scenes/${sceneId}/videos/${clipId}/use-version`);
      await fetchClips();
    } catch (err) {
      console.error("Use version failed:", err);
      await fetchClips();
    }
  }

  // ---- Drag handlers ----------------------------------------------------

  function handleDragStart(e: React.DragEvent, sceneId: string) {
    dragIdRef.current = sceneId;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", sceneId);
    const el = e.currentTarget as HTMLElement;
    requestAnimationFrame(() => el.classList.add("opacity-30", "scale-95"));
  }

  function handleDragEnd(e: React.DragEvent) {
    const el = e.currentTarget as HTMLElement;
    el.classList.remove("opacity-30", "scale-95");
    dragIdRef.current = null;
    setDragOverId(null);
  }

  function handleDragOver(e: React.DragEvent, sceneId: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverId(sceneId);
  }

  function handleDragLeave() {
    setDragOverId(null);
  }

  const handleDrop = useCallback(
    async (e: React.DragEvent, targetSceneId: string) => {
      e.preventDefault();
      const draggedId = dragIdRef.current;
      if (!draggedId || draggedId === targetSceneId) {
        setDragOverId(null);
        dragIdRef.current = null;
        return;
      }

      const ids = scenes.map((s) => s.id);
      const draggedIdx = ids.indexOf(draggedId);
      const targetIdx = ids.indexOf(targetSceneId);
      if (draggedIdx === -1 || targetIdx === -1) return;

      const newIds = [...ids];
      newIds.splice(draggedIdx, 1);
      const insertIdx = draggedIdx < targetIdx ? targetIdx - 1 : targetIdx;
      newIds.splice(insertIdx, 0, draggedId);

      reorderScenes(newIds);
      dragIdRef.current = null;
      setDragOverId(null);

      const project = useProjectStore.getState().currentProject;
      if (project) {
        try {
          await post("/scenes/reorder", { sceneIds: newIds });
        } catch (err) {
          console.error("Reorder persist failed:", err);
        }
      }
    },
    [scenes, reorderScenes, post],
  );

  const handleClick = useCallback(
    (sceneId: string) => {
      selectScene(selectedSceneId === sceneId ? null : sceneId);
    },
    [selectScene, selectedSceneId],
  );

  // ---- Render -----------------------------------------------------------

  if (scenes.length === 0) {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <TrackHeader label={label} count={0} type={type} />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-zinc-600">
            {currentProject ? "暂无镜头，请先在聊天框生成脚本" : "请先创建或打开一个项目"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <TrackHeader
        label={label}
        count={scenes.length}
        type={type}
        onGenerateAll={
          type === "video"
            ? () => handleGenerateVideo()
            : undefined
        }
        isGenerating={isGeneratingVideo}
        progress={videoJobProgress}
      />
      <div className="flex-1 overflow-x-auto overflow-y-hidden px-2 pb-2">
        <div className="flex gap-2 h-full items-start pt-2 min-w-min">
          {scenes.map((scene) => (
            <TimelineItem
              key={scene.id}
              scene={scene}
              type={type}
              isSelected={selectedSceneId === scene.id}
              isDragOver={dragOverId === scene.id}
              thumbnailUrl={getThumbnailUrl(scene.id)}
              clip={getClip(scene.id)}
              allClips={clipsByScene[scene.id]}
              onSelectVersion={handleSelectVersion}
              projectId={currentProject?.id}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={handleClick}
              onGenerateVideo={
                type === "video"
                  ? (sid) => handleGenerateVideo([sid])
                  : undefined
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Track header sub-component
// ---------------------------------------------------------------------------

function TrackHeader({
  label,
  count,
  type,
  onGenerateAll,
  isGenerating,
  progress,
}: {
  label: string;
  count: number;
  type: "storyboard" | "video";
  onGenerateAll?: () => void;
  isGenerating?: boolean;
  progress?: number;
}) {
  const labelCN = type === "video" ? "text-blue-400" : "text-zinc-500";

  return (
    <div className="h-7 flex items-center px-3 gap-2 shrink-0">
      <span className={`text-[11px] font-medium uppercase tracking-wider ${labelCN}`}>
        {label}
      </span>
      <span className="text-[10px] text-zinc-600">
        {count > 0 ? `${count} 个${label === "Storyboard" ? "镜头" : "片段"}` : ""}
      </span>
      <div className="flex-1" />

      {type === "video" && onGenerateAll && (
        <button
          onClick={onGenerateAll}
          disabled={isGenerating || count === 0}
          className={`text-[10px] px-2 py-0.5 rounded font-medium transition-colors ${
            isGenerating
              ? "bg-blue-600/20 text-blue-400 animate-pulse cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-500 text-white disabled:bg-zinc-700 disabled:text-zinc-500"
          }`}
        >
          {isGenerating ? `生成中... ${progress ?? 0}%` : "生成全部视频"}
        </button>
      )}
    </div>
  );
}
