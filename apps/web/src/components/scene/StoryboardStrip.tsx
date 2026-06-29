// =========================================================================
// StoryboardStrip — 水平胶片条（剪映风格）：预览 + 拖拽排序故事板帧
// =========================================================================

import { useProjectStore } from "../../stores/projectStore";
import { useApi } from "../../hooks/useApi";
import { GripHorizontal, Play, ImagePlus } from "lucide-react";

interface StoryboardStripProps {
  sceneId: string;
  selectedIndex: number;
  onSelect: (index: number) => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
  onRegen?: () => void;
  isRegenerating?: boolean;
}

export default function StoryboardStrip({ sceneId, selectedIndex, onSelect, onReorder, onRegen, isRegenerating }: StoryboardStripProps) {
  const panels = useProjectStore((s) => s.panelsByScene[sceneId] ?? []);
  const currentProject = useProjectStore((s) => s.currentProject);

  const labels = ["起始帧", "中间帧", "结束帧"];
  const readyPanels = panels.filter((p) => p.status === "ready");

  if (readyPanels.length === 0) return null;

  function handleDragStart(e: React.DragEvent, index: number) {
    e.dataTransfer.setData("text/plain", String(index));
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function handleDrop(e: React.DragEvent, targetIndex: number) {
    e.preventDefault();
    const fromIndex = parseInt(e.dataTransfer.getData("text/plain"));
    if (!isNaN(fromIndex) && fromIndex !== targetIndex && onReorder) {
      onReorder(fromIndex, targetIndex);
    }
  }

  return (
    <div className="bg-gray-800/60 border-t border-gray-700 px-3 py-2 shrink-0 z-10">
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[10px] font-medium text-gray-400">
          Storyboard · {readyPanels.length} frames
        </span>
        <div className="flex-1" />
        {onRegen && (
          <button
            onClick={onRegen}
            disabled={isRegenerating}
            className="text-[10px] bg-gray-700 hover:bg-gray-600 text-gray-300 px-2 py-0.5 rounded border border-gray-600 transition disabled:opacity-50 flex items-center gap-1"
          >
            <ImagePlus className="h-3 w-3" />
            {isRegenerating ? "Generating..." : "Regen"}
          </button>
        )}
      </div>
      <div className="flex items-center gap-3 overflow-x-auto pb-1">
        {readyPanels.map((panel) => {
          const idx = panel.panelIndex;
          const isSelected = idx === selectedIndex;
          return (
            <div
              key={idx}
              draggable
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, idx)}
              onClick={() => onSelect(idx)}
              className={`shrink-0 cursor-pointer rounded-lg overflow-hidden border-2 transition-all group relative ${
                isSelected ? "border-blue-500 ring-2 ring-blue-500/30 scale-105" : "border-gray-600 hover:border-gray-400 opacity-70 hover:opacity-100"
              }`}
              style={{ width: 120, aspectRatio: "16/9" }}
            >
              <img
                src={`/api/projects/${currentProject?.id}/scenes/${sceneId}/panels/${idx}/image?v=${panel.version}`}
                alt={labels[idx] ?? `Frame ${idx}`}
                className="w-full h-full object-cover"
                draggable={false}
              />
              {/* Label overlay */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-1.5 py-1">
                <span className="text-[9px] text-white font-medium">{labels[idx] ?? `Frame ${idx}`}</span>
                {isSelected && <Play className="h-2.5 w-2.5 text-blue-400 inline ml-1" />}
              </div>
              {/* Drag handle */}
              <div className="absolute top-0 left-0 right-0 flex justify-center opacity-0 group-hover:opacity-100 transition pt-0.5">
                <GripHorizontal className="h-3 w-3 text-white/70" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
