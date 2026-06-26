// =========================================================================
// SceneCard — 单个镜头的主操作卡片
// 包含：镜头信息展示 → 三图素材区 → 视频版本区 → 镜头编辑器
// =========================================================================

import { type ReactNode } from "react";
import type { Scene } from "@ai-video-canvas/shared";
import PanelGrid from "./PanelGrid";
import SceneVideoPanel from "./SceneVideoPanel";
import SceneInspector from "./SceneInspector";

interface SceneCardProps {
  scene: Scene;
  isSelected: boolean;
  saving?: boolean;
  onSelect: () => void;
  onFieldChange: (sceneId: string, field: string, value: string | boolean) => void;
}

export default function SceneCard({ scene, isSelected, saving, onSelect, onFieldChange }: SceneCardProps) {
  return (
    <div
      onClick={onSelect}
      className={`rounded-lg border p-4 cursor-pointer transition-colors ${
        isSelected
          ? "border-blue-600 bg-blue-600/5"
          : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-zinc-500 font-mono">#{scene.order}</span>
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded ${
            scene.status === "draft"
              ? "bg-zinc-800 text-zinc-500"
              : scene.status === "storyboard_ready"
                ? "bg-green-600/20 text-green-400"
                : scene.status === "video_ready"
                  ? "bg-blue-600/20 text-blue-400"
                  : "bg-zinc-800 text-zinc-500"
          }`}
        >
          {scene.status}
        </span>
      </div>

      <h4 className="font-medium text-zinc-200 text-sm mb-1">{scene.title}</h4>
      <p className="text-xs text-zinc-500 line-clamp-2 mb-2">{scene.summary}</p>

      {/* Meta tags */}
      <div className="flex flex-wrap gap-1.5">
        {scene.shotSize && (
          <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">
            {scene.shotSize}
          </span>
        )}
        {scene.cameraMovement && (
          <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">
            {scene.cameraMovement}
          </span>
        )}
        {scene.location && (
          <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">
            {scene.location}
          </span>
        )}
        <span className="text-[10px] bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded">
          {scene.duration}s
        </span>
      </div>

      {/* Visual desc preview */}
      {scene.visualDescription && (
        <p className="text-[10px] text-zinc-600 mt-2 line-clamp-1 italic">
          {scene.visualDescription}
        </p>
      )}

      {/* Expanded content */}
      {isSelected && (
        <div className="mt-4 space-y-4" onClick={(e) => e.stopPropagation()}>
          <PanelGrid sceneId={scene.id} />
          <SceneVideoPanel sceneId={scene.id} />
          <details open>
            <summary className="text-xs text-zinc-500 cursor-pointer select-none hover:text-zinc-400 font-medium tracking-wide">
              镜头编辑器 ▼
            </summary>
            <div className="mt-2">
              <SceneInspector scene={scene} />
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
