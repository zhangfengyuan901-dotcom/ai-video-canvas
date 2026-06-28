// =========================================================================
// CanvasViewport — 中心画布视口，显示选中镜头的三图故事板
// =========================================================================

import PanelGrid from "../scene/PanelGrid";
import { useUIStore } from "../../stores/uiStore";
import { useProjectStore } from "../../stores/projectStore";
import { useVideoClips } from "../../hooks/useVideoClips";
import { Image, Stethoscope } from "lucide-react";

interface CanvasViewportProps {
  sceneId: string;
}

export default function CanvasViewport({ sceneId }: CanvasViewportProps) {
  const openDiagnosticDrawer = useUIStore((s) => s.openDiagnosticDrawer);
  const clipsByScene = useProjectStore((s) => s.clipsByScene);
  const { getCurrentClip } = useVideoClips();

  const currentClip = getCurrentClip(sceneId);
  const allClips = clipsByScene[sceneId] ?? [];
  const displayClip = currentClip ?? (allClips.length > 0 ? allClips[allClips.length - 1] : null);

  function handleOpenDiagnostics() {
    if (displayClip) {
      openDiagnosticDrawer(displayClip);
    }
  }

  return (
    <div className="flex-1 canvas-bg relative overflow-hidden flex items-center justify-center p-8">
      {/* Storyboard grid */}
      <div className="w-full max-w-4xl h-full max-h-[60vh]">
        <PanelGrid sceneId={sceneId} />
      </div>

      {/* Floating diagnostics button */}
      <button
        onClick={handleOpenDiagnostics}
        className="absolute top-4 right-4 bg-gray-800/80 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded text-xs border border-gray-600 backdrop-blur transition flex items-center gap-1.5"
        title="RunningHub Diagnostics"
      >
        <Stethoscope className="h-3.5 w-3.5" />
        Diagnostics
      </button>
    </div>
  );
}

// Also export the empty state for reuse
export function CanvasViewportEmpty() {
  return (
    <div className="flex-1 canvas-bg relative overflow-hidden flex items-center justify-center p-8">
      <div className="text-center text-gray-500">
        <Image className="h-10 w-10 mx-auto mb-3 opacity-50" />
        <p className="text-sm">Select a shot from the timeline to edit</p>
      </div>
    </div>
  );
}
