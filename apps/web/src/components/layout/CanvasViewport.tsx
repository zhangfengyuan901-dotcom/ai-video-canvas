// =========================================================================
// CanvasViewport — 中央画布预览区（剪映风格大图预览）
// =========================================================================

import { useState } from "react";
import PanelGrid from "../scene/PanelGrid";
import StoryboardStrip from "../scene/StoryboardStrip";
import { useUIStore } from "../../stores/uiStore";
import { useProjectStore } from "../../stores/projectStore";
import { useVideoClips } from "../../hooks/useVideoClips";
import { Image, Stethoscope, ChevronLeft, ChevronRight } from "lucide-react";

interface CanvasViewportProps {
  sceneId: string;
}

export default function CanvasViewport({ sceneId }: CanvasViewportProps) {
  const openDiagnosticDrawer = useUIStore((s) => s.openDiagnosticDrawer);
  const clipsByScene = useProjectStore((s) => s.clipsByScene);
  const panels = useProjectStore((s) => s.panelsByScene[sceneId] ?? []);
  const currentProject = useProjectStore((s) => s.currentProject);
  const { getCurrentClip } = useVideoClips();

  const [selectedPanelIndex, setSelectedPanelIndex] = useState<0 | 1 | 2>(0);

  const currentClip = getCurrentClip(sceneId);
  const allClips = clipsByScene[sceneId] ?? [];
  const displayClip = currentClip ?? (allClips.length > 0 ? allClips[allClips.length - 1] : null);
  const readyPanels = panels.filter((p) => p.status === "ready");
  const hasReadyPanels = readyPanels.length > 0;

  // Ensure selected index is valid
  const safeIndex = readyPanels.find((p) => p.panelIndex === selectedPanelIndex)
    ? selectedPanelIndex
    : readyPanels[0]?.panelIndex ?? 0;
  const selectedPanel = panels.find((p) => p.panelIndex === safeIndex && p.status === "ready");

  const labels = ["起始帧", "中间帧", "结束帧"];

  function handleOpenDiagnostics() {
    if (displayClip) openDiagnosticDrawer(displayClip);
  }

  function prevFrame() {
    const readyIndices = readyPanels.map((p) => p.panelIndex).sort();
    const curIdx = readyIndices.indexOf(safeIndex);
    if (curIdx > 0) setSelectedPanelIndex(readyIndices[curIdx - 1]);
  }

  function nextFrame() {
    const readyIndices = readyPanels.map((p) => p.panelIndex).sort();
    const curIdx = readyIndices.indexOf(safeIndex);
    if (curIdx < readyIndices.length - 1) setSelectedPanelIndex(readyIndices[curIdx + 1]);
  }

  // No panels at all — show generation UI
  if (!hasReadyPanels && panels.length === 0) {
    return (
      <div className="flex-1 canvas-bg relative overflow-hidden flex items-center justify-center p-8">
        <PanelGrid sceneId={sceneId} />
      </div>
    );
  }

  // Some panels exist but none ready — show PanelGrid with status
  if (!hasReadyPanels) {
    return (
      <div className="flex-1 canvas-bg relative overflow-hidden flex items-center justify-center p-8">
        <PanelGrid sceneId={sceneId} />
      </div>
    );
  }

  // Has ready panels — show preview mode
  return (
    <div className="flex-1 canvas-bg relative overflow-hidden flex flex-col">
      {/* Large Preview */}
      <div className="flex-1 flex items-center justify-center p-6 relative">
        {/* Left arrow */}
        {readyPanels.length > 1 && (
          <button
            onClick={prevFrame}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center transition"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}

        {/* Preview image */}
        <div className="max-w-full max-h-full rounded-xl overflow-hidden shadow-2xl border border-gray-700">
          {selectedPanel ? (
            <img
              src={`/api/projects/${currentProject?.id}/scenes/${sceneId}/panels/${selectedPanel.panelIndex}/image?v=${selectedPanel.version}`}
              alt={labels[selectedPanel.panelIndex] ?? `Frame ${selectedPanel.panelIndex}`}
              className="max-w-full max-h-[55vh] object-contain"
            />
          ) : (
            <div className="w-[640px] h-[360px] bg-gray-800 flex items-center justify-center">
              <Image className="h-12 w-12 text-gray-600" />
            </div>
          )}
        </div>

        {/* Right arrow */}
        {readyPanels.length > 1 && (
          <button
            onClick={nextFrame}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center transition"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}

        {/* Frame indicator */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-3 py-1 rounded-full">
          {labels[safeIndex] ?? `Frame ${safeIndex}`}
          {readyPanels.length > 1 && ` (${readyPanels.map(p => p.panelIndex).sort().indexOf(safeIndex) + 1}/${readyPanels.length})`}
        </div>

        {/* Diagnostics button */}
        <button
          onClick={handleOpenDiagnostics}
          className="absolute top-3 right-3 bg-gray-800/80 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded text-xs border border-gray-600 backdrop-blur transition flex items-center gap-1.5 z-10"
        >
          <Stethoscope className="h-3.5 w-3.5" /> Diagnostics
        </button>
      </div>

      {/* Filmstrip */}
      <StoryboardStrip
        sceneId={sceneId}
        selectedIndex={safeIndex}
        onSelect={(idx) => setSelectedPanelIndex(idx as 0 | 1 | 2)}
      />
    </div>
  );
}
