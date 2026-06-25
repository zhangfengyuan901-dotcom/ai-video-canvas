// =========================================================================
// TimelineItem — 单个时间线卡片（可拖拽，支持 Storyboard / Video）
// =========================================================================

import { type DragEvent, useRef, useState } from "react";
import type { Scene, VideoClip } from "@ai-video-canvas/shared";

interface TimelineItemProps {
  scene: Scene;
  type: "storyboard" | "video";
  isSelected: boolean;
  isDragOver: boolean;
  thumbnailUrl: string | null;
  clip: VideoClip | null;
  allClips?: VideoClip[];
  onSelectVersion?: (sceneId: string, clipId: string) => void;
  projectId?: string;
  onDragStart: (e: DragEvent, sceneId: string) => void;
  onDragEnd: (e: DragEvent) => void;
  onDragOver: (e: DragEvent, sceneId: string) => void;
  onDragLeave: () => void;
  onDrop: (e: DragEvent, sceneId: string) => void;
  onClick: (sceneId: string) => void;
  onGenerateVideo?: (sceneId: string) => void;
}

export default function TimelineItem({
  scene,
  type,
  isSelected,
  isDragOver,
  thumbnailUrl,
  clip,
  allClips,
  onSelectVersion,
  projectId,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  onClick,
  onGenerateVideo,
}: TimelineItemProps) {
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const clipVideoUrl =
    clip && clip.status === "ready" && projectId
      ? `/api/projects/${projectId}/scenes/${scene.id}/videos/${clip.id}/video`
      : null;

  function handleVideoClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (!videoRef.current) return;
    if (playing) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setPlaying(!playing);
  }

  function handleGenerateClick(e: React.MouseEvent) {
    e.stopPropagation();
    onGenerateVideo?.(scene.id);
  }

  function handleVersionSwitch(e: React.MouseEvent) {
    e.stopPropagation();
    if (!allClips || allClips.length < 2 || !clip) return;
    const currentIdx = allClips.findIndex((c) => c.id === clip.id);
    const nextIdx = (currentIdx + 1) % allClips.length;
    onSelectVersion?.(scene.id, allClips[nextIdx].id);
  }

  return (
    <div
      draggable
      onClick={() => onClick(scene.id)}
      onDragStart={(e) => onDragStart(e, scene.id)}
      onDragEnd={onDragEnd}
      onDragOver={(e) => onDragOver(e, scene.id)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, scene.id)}
      className={`
        h-full w-44 shrink-0 rounded-lg border cursor-pointer
        flex flex-col overflow-hidden transition-all duration-150
        ${
          isSelected
            ? "border-blue-500 bg-blue-600/10"
            : "border-zinc-700/60 bg-zinc-800/80 hover:border-zinc-600"
        }
        ${isDragOver ? "border-l-blue-400 border-l-2 ring-1 ring-blue-500/30" : ""}
      `}
    >
      {/* Thumbnail area */}
      <div className="flex-1 relative overflow-hidden bg-zinc-900">
        {type === "storyboard" ? (
          thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={scene.title}
              className="h-full w-full object-cover"
              loading="lazy"
              draggable={false}
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center">
              <div className="flex gap-0.5 opacity-30">
                <div className="w-5 h-7 rounded-sm border border-zinc-600" />
                <div className="w-5 h-7 rounded-sm border border-zinc-600 bg-zinc-700" />
                <div className="w-5 h-7 rounded-sm border border-zinc-600" />
              </div>
            </div>
          )
        ) : clip && clip.status === "ready" && clipVideoUrl ? (
          /* Video ready — show playable preview */
          <div
            className="h-full w-full relative cursor-pointer group"
            onClick={handleVideoClick}
          >
            <video
              ref={videoRef}
              src={clipVideoUrl}
              className="h-full w-full object-cover"
              preload="metadata"
              muted
              loop
              playsInline
            />
            {/* Play/pause overlay */}
            <div
              className={`absolute inset-0 flex items-center justify-center transition-opacity ${
                playing ? "opacity-0 group-hover:opacity-100" : "opacity-100"
              } bg-black/20`}
            >
              <svg
                className="w-7 h-7 text-white drop-shadow-lg"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                {playing ? (
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                ) : (
                  <path d="M8 5v14l11-7z" />
                )}
              </svg>
            </div>
            {/* Duration badge */}
            <div className="absolute bottom-1 right-1">
              <span className="text-[9px] bg-black/60 text-zinc-300 px-1 px-1 py-0.5 rounded leading-none">
                {clip.duration}s
              </span>
            </div>
          </div>
        ) : clip && clip.status === "running" ? (
          <div className="h-full w-full flex flex-col items-center justify-center gap-1.5">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-[10px] text-blue-400">生成中...</span>
          </div>
        ) : clip && clip.status === "queued" ? (
          <div className="h-full w-full flex flex-col items-center justify-center gap-1">
            <svg className="w-5 h-5 text-zinc-500 animate-pulse" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z" />
            </svg>
            <span className="text-[10px] text-zinc-500">排队中</span>
          </div>
        ) : clip && clip.status === "failed" ? (
          <div className="h-full w-full flex flex-col items-center justify-center gap-1 p-2">
            <svg className="w-5 h-5 text-red-400 shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
            </svg>
            <span className="text-[9px] text-red-400 text-center leading-tight">
              {clip.error ? clip.error.slice(0, 30) : "生成失败"}
            </span>
          </div>
        ) : (
          /* No clip — show placeholder with generate button */
          <div className="h-full w-full flex flex-col items-center justify-center gap-1">
            <svg className="w-7 h-7 text-zinc-600" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            <button
              onClick={handleGenerateClick}
              className="text-[9px] bg-zinc-700 hover:bg-zinc-600 text-zinc-300 px-2 py-0.5 rounded transition-colors"
            >
              生成
            </button>
          </div>
        )}

        {/* Scene number badge */}
        <div className="absolute top-1 left-1">
          <span className="text-[10px] font-mono bg-black/60 text-zinc-300 px-1.5 py-0.5 rounded leading-none">
            #{scene.order}
          </span>
        </div>
      </div>

      {/* Label */}
      <div className="h-7 px-2 flex items-center truncate border-t border-zinc-700/40">
        <span className="text-[11px] text-zinc-400 truncate leading-none">
          {scene.title || `Scene ${scene.order}`}
        </span>
        {/* Version indicator for video clips */}
        {type === "video" && clip && clip.status === "ready" && allClips && allClips.length > 1 && (
          <button
            onClick={handleVersionSwitch}
            title="点击切换版本"
            className="ml-1 text-[9px] bg-zinc-700 hover:bg-zinc-600 text-zinc-300 px-1 rounded shrink-0 leading-none py-0.5 transition-colors"
          >
            v{clip.version}/{allClips.length}
          </button>
        )}
        {clip && (
          <span
            className={`ml-auto text-[9px] shrink-0 ${
              clip.status === "ready"
                ? "text-green-400"
                : clip.status === "failed"
                  ? "text-red-400"
                  : clip.status === "running"
                    ? "text-blue-400"
                    : "text-zinc-500"
            }`}
          >
            {clip.status === "ready"
              ? "✓"
              : clip.status === "failed"
                ? "✗"
                : clip.status === "running"
                  ? "⋯"
                  : "○"}
          </span>
        )}
      </div>
    </div>
  );
}
