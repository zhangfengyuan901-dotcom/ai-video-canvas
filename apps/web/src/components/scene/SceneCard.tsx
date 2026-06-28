// =========================================================================
// SceneCard — 单个镜头卡片 (simplified — click to select, no expanded content)
// =========================================================================

import type { Scene } from "@ai-video-canvas/shared";
import StatusBadge from "../ui/StatusBadge";

interface SceneCardProps {
  scene: Scene;
  isSelected: boolean;
  saving?: boolean;
  onSelect: () => void;
}

export default function SceneCard({ scene, isSelected, saving, onSelect }: SceneCardProps) {
  return (
    <div
      onClick={onSelect}
      className={`rounded-xl border transition-all duration-200 cursor-pointer p-4 ${
        isSelected
          ? "border-blue-500/50 bg-blue-500/[0.06] shadow-sm shadow-blue-500/10"
          : "border-gray-700 bg-gray-800 hover:border-gray-600 hover:bg-gray-800/80"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-gray-500 font-mono font-medium">#{scene.order}</span>
          <StatusBadge status={scene.status} />
        </div>
        {saving && <StatusBadge status="running" label="Saving..." pulse />}
      </div>

      <h4 className="font-medium text-gray-200 text-sm tracking-tight mb-1">{scene.title}</h4>
      {scene.summary && (
        <p className="text-xs text-gray-500 line-clamp-2 mb-2 leading-relaxed">{scene.summary}</p>
      )}

      {/* Meta tags */}
      <div className="flex flex-wrap gap-1.5">
        {scene.shotSize && (
          <span className="inline-flex items-center rounded-md border border-gray-700 bg-gray-700/50 px-1.5 py-0.5 text-[10px] font-medium text-gray-400">
            {scene.shotSize}
          </span>
        )}
        {scene.cameraMovement && (
          <span className="inline-flex items-center rounded-md border border-gray-700 bg-gray-700/50 px-1.5 py-0.5 text-[10px] font-medium text-gray-400">
            {scene.cameraMovement}
          </span>
        )}
        {scene.location && (
          <span className="inline-flex items-center rounded-md border border-gray-700 bg-gray-700/50 px-1.5 py-0.5 text-[10px] font-medium text-gray-400">
            {scene.location}
          </span>
        )}
        <span className="inline-flex items-center rounded-md border border-gray-700 bg-gray-700/50 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
          {scene.duration}s
        </span>
      </div>

      {/* Visual desc preview */}
      {scene.visualDescription && (
        <p className="text-[10px] text-gray-600 mt-2 line-clamp-1 italic">
          {scene.visualDescription}
        </p>
      )}
    </div>
  );
}
