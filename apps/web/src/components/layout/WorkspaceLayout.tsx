// =========================================================================
// WorkspaceLayout — 三栏 + 底部时间线布局容器
// =========================================================================

import ChatPanel from "./ChatPanel";
import CanvasPanel from "./CanvasPanel";
import TimelinePanel from "../timeline/TimelinePanel";

export default function WorkspaceLayout() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 左侧聊天 + 中间画布 */}
      <div className="flex-1 flex overflow-hidden">
        <ChatPanel />
        <CanvasPanel />
      </div>

      {/* 底部双轨时间线 Phase 3 */}
      <TimelinePanel />
    </div>
  );
}
