// =========================================================================
// SceneCard — 单个镜头的主操作卡片 (redesigned)
// 包含：镜头信息展示 → 三图素材区 → 视频版本区 → 镜头编辑器
// =========================================================================

import { type ReactNode } from "react";
import type { Scene } from "@ai-video-canvas/shared";
import StatusBadge from "../ui/StatusBadge";
import PanelGrid from "./PanelGrid";
import SceneVideoPanel from "./SceneVideoPanel";
import SceneInspector from "./SceneInspector";
import { Settings2, ChevronDown } from "lucide-react";

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
      className={`rounded-xl border transition-all duration-200 ${
        isSelected
          ? "border-blue-500/50 bg-blue-500/[0.04] shadow-sm shadow-blue-500/10"
          : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.03]"
      } cursor-pointer`}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-zinc-500 font-mono font-medium">#{scene.order}</span>
            <StatusBadge status={scene.status} />
          </div>
          {saving && <StatusBadge status="running" label="保存中..." pulse />}
        </div>

        <h4 className="font-medium text-zinc-200 text-sm tracking-tight mb-1">{scene.title}</h4>
        {scene.summary && (
          <p className="text-xs text-zinc-500 line-clamp-2 mb-2 leading-relaxed">{scene.summary}</p>
        )}

        {/* Meta tags */}
        <div className="flex flex-wrap gap-1.5">
          {scene.shotSize && (
            <span className="inline-flex items-center rounded-md border border-white/[0.06] bg-white/[0.03] px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
              {scene.shotSize}
            </span>
          )}
          {scene.cameraMovement && (
            <span className="inline-flex items-center rounded-md border border-white/[0.06] bg-white/[0.03] px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
              {scene.cameraMovement}
            </span>
          )}
          {scene.location && (
            <span className="inline-flex items-center rounded-md border border-white/[0.06] bg-white/[0.03] px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
              {scene.location}
            </span>
          )}
          <span className="inline-flex items-center rounded-md border border-white/[0.06] bg-white/[0.03] px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">
            {scene.duration}s
          </span>
        </div>

        {/* Visual desc preview */}
        {scene.visualDescription && (
          <p className="text-[10px] text-zinc-600 mt-2 line-clamp-1 italic">
            {scene.visualDescription}
          </p>
        )}

        {/* Expand indicator */}
        <div className="flex items-center gap-1 mt-2 text-[10px] text-zinc-600">
          <ChevronDown className={`h-3 w-3 transition-transform ${isSelected ? "rotate-180" : ""}`} />
          {isSelected ? "收起" : "展开详情"}
        </div>
      </div>

      {/* Expanded content */}
      {isSelected && (
        <div className="px-4 pb-4 space-y-4 border-t border-white/[0.06] pt-4" onClick={(e) => e.stopPropagation()}>
          <PanelGrid sceneId={scene.id} />
          <SceneVideoPanel sceneId={scene.id} />
          <details open>
            <summary className="flex items-center gap-1.5 text-xs text-zinc-500 cursor-pointer select-none hover:text-zinc-400 font-medium tracking-wide transition-colors">
              <Settings2 className="h-3.5 w-3.5" />
              镜头编辑器
            </summary>
            <div className="mt-3">
              <SceneInspector scene={scene} />
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
