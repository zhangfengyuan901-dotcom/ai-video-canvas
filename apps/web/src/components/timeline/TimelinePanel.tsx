// =========================================================================
// TimelinePanel — 底部双轨时间线容器 (redesigned)
// =========================================================================

import TimelineTrack from "./TimelineTrack";

export default function TimelinePanel() {
  return (
    <div className="h-52 bg-[#08090c]/90 border-t border-white/[0.06] flex flex-col shrink-0 select-none">
      <TimelineTrack label="故事板" type="storyboard" />
      <div className="border-t border-white/[0.06]" />
      <TimelineTrack label="视频" type="video" />
    </div>
  );
}
