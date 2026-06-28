// =========================================================================
// WorkspaceLayout — 三栏 + 底部时间线 + 全局诊断抽屉 (redesigned)
// =========================================================================

import ChatPanel from "./ChatPanel";
import CanvasPanel from "./CanvasPanel";
import TimelinePanel from "../timeline/TimelinePanel";
import ClipDiagnosticsDrawer from "../scene/ClipDiagnosticsDrawer";
import { useUIStore } from "../../stores/uiStore";
import { useProjectStore } from "../../stores/projectStore";
import { useVideoClips } from "../../hooks/useVideoClips";

export default function WorkspaceLayout() {
  const { diagnosticDrawerOpen, diagnosticClip, closeDiagnosticDrawer } = useUIStore();
  const currentProject = useProjectStore((s) => s.currentProject);
  const isGeneratingVideo = useProjectStore((s) => s.isGeneratingVideo);
  const { retryFailedClip } = useVideoClips();

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      {/* 左侧聊天 + 中间画布 */}
      <div className="flex-1 flex overflow-hidden">
        <ChatPanel />
        <CanvasPanel />
      </div>

      {/* 底部双轨时间线 */}
      <TimelinePanel />

      {/* 全局诊断抽屉 — 从右侧滑入 */}
      <ClipDiagnosticsDrawer
        clip={diagnosticClip}
        open={diagnosticDrawerOpen}
        onClose={closeDiagnosticDrawer}
        onRegenerate={
          diagnosticClip?.status === "failed"
            ? () => {
                if (diagnosticClip && currentProject) {
                  retryFailedClip(
                    diagnosticClip.sceneId,
                    diagnosticClip.id,
                    diagnosticClip.diagnostics?.errorMessage ?? diagnosticClip.error ?? undefined,
                  );
                }
              }
            : undefined
        }
        isRegenerating={isGeneratingVideo}
      />
    </div>
  );
}
