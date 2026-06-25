// =========================================================================
// TimelinePanel — 底部双轨时间线容器
// =========================================================================

import TimelineTrack from "./TimelineTrack";

export default function TimelinePanel() {
  return (
    <div className="h-52 bg-zinc-900 border-t border-zinc-800 flex flex-col shrink-0 select-none">
      <TimelineTrack label="Storyboard" type="storyboard" />
      <div className="border-t border-zinc-800" />
      <TimelineTrack label="Video" type="video" />
    </div>
  );
}
