// =========================================================================
// TimelineTrack — 单条时间线轨道 (Storyboard / Video) (redesigned)
// 支持拖拽排序 + 视频生成管理（Phase 4）+ zoom 缩放
// =========================================================================

import { useState, useRef, useCallback, useEffect } from "react";
import { useProjectStore } from "../../stores/projectStore";
import { useApi } from "../../hooks/useApi";
import { useVideoClips } from "../../hooks/useVideoClips";
import TimelineItem from "./TimelineItem";
import { VideoIcon, Image } from "lucide-react";

interface TimelineTrackProps {
  label: string;
  type: "storyboard" | "video";
  zoom?: number;
}

export default function TimelineTrack({ label, type, zoom = 50 }: TimelineTrackProps) {
  const scenes = useProjectStore((s) => s.scenes);
  const panelsByScene = useProjectStore((s) => s.panelsByScene);
  const clipsByScene = useProjectStore((s) => s.clipsByScene);
  const currentProject = useProjectStore((s) => s.currentProject);
  const selectedSceneId = useProjectStore((s) => s.selectedSceneId);
  const selectScene = useProjectStore((s) => s.selectScene);
  const reorderScenes = useProjectStore((s) => s.reorderScenes);
  const isGeneratingVideo = useProjectStore((s) => s.isGeneratingVideo);
  const { post, get } = useApi();
  const videoClips = useVideoClips();

  const [selectedClipId, setSelectedClipId] = useState<Record<string, string>>({});
  const [videoJobId, setVideoJobId] = useState<string | null>(null);
  const [videoJobProgress, setVideoJobProgress] = useState<number>(0);
  const dragIdRef = useRef<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Scale factor from zoom (0–100) → 0.5x – 1.5x
  const scale = 0.5 + zoom / 100;

  // ---- Video: fetch clips (stable callback via getState) ----------------

  const fetchClips = useCallback(async () => {
    const project = useProjectStore.getState().currentProject;
    if (!project) return;
    try {
      const data = await videoClips.fetchClips();
      if (!data) return;
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
  }, [videoClips.fetchClips]);

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
    return `/api/projects/${projectId}/scenes/${sceneId}/preview`;
  }

  function getClip(sceneId: string) {
    const clips = clipsByScene[sceneId];
    if (!clips || clips.length === 0) return null;
    const overrideId = selectedClipId[sceneId];
    if (overrideId) {
      const override = clips.find((c) => c.id === overrideId);
      if (override) return override;
    }
    return clips.reduce((latest, c) => (c.version > latest.version ? c : latest), clips[0]);
  }

  async function handleSelectVersion(sceneId: string, clipId: string) {
    const project = useProjectStore.getState().currentProject;
    if (!project) return;

    setSelectedClipId((prev) => ({ ...prev, [sceneId]: clipId }));

    try {
      const data = await videoClips.selectVersion(sceneId, clipId);
      if (data) {
        const currentIds: Record<string, string> = {};
        for (const clip of data) {
          if (clip.isCurrent) {
            currentIds[clip.sceneId] = clip.id;
          }
        }
        setSelectedClipId(currentIds);
      }
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

  const typeIcon = type === "video" ? <VideoIcon className="h-3 w-3" /> : <Image className="h-3 w-3" />;

  if (scenes.length === 0) {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <TrackHeader label={label} count={0} type={type} typeIcon={typeIcon} />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-gray-500">
            {currentProject ? "No shots yet — generate a script first" : "Create or open a project first"}
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
        typeIcon={typeIcon}
        onGenerateAll={
          type === "video"
            ? () => handleGenerateVideo()
            : undefined
        }
        isGenerating={isGeneratingVideo}
        progress={videoJobProgress}
      />
      <div className="flex-1 overflow-x-auto overflow-y-hidden px-2 pb-2">
        <div
          className="flex gap-2 h-full items-start pt-2 min-w-min"
          style={{ transform: `scaleX(${scale})`, transformOrigin: "left center" }}
        >
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
  typeIcon,
  onGenerateAll,
  isGenerating,
  progress,
}: {
  label: string;
  count: number;
  type: "storyboard" | "video";
  typeIcon: React.ReactNode;
  onGenerateAll?: () => void;
  isGenerating?: boolean;
  progress?: number;
}) {
  return (
    <div className="h-7 flex items-center px-3 gap-2 shrink-0">
      <span className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-gray-400">
        {typeIcon}
        {label}
      </span>
      <span className="text-[10px] text-gray-500">
        {count > 0 ? `${count} clips` : ""}
      </span>
      <div className="flex-1" />

      {type === "video" && onGenerateAll && (
        <button
          onClick={onGenerateAll}
          disabled={isGenerating || count === 0}
          className={`text-[10px] px-2 py-0.5 rounded font-medium transition-all ${
            isGenerating
              ? "bg-blue-600/20 text-blue-400 animate-pulse cursor-not-allowed"
              : "bg-blue-600/80 hover:bg-blue-600 text-white disabled:opacity-40 disabled:pointer-events-none"
          }`}
        >
          {isGenerating ? `Generating... ${progress ?? 0}%` : "Generate All Video"}
        </button>
      )}
    </div>
  );
}
