// =========================================================================
// TimelinePanel — 底部双轨时间线容器 + 工具栏 (redesigned to match UI mockup)
// =========================================================================

import { useState } from "react";
import TimelineTrack from "./TimelineTrack";
import { Layers, Magnet, Minus, Plus } from "lucide-react";

export default function TimelinePanel() {
  const [snapOn, setSnapOn] = useState(true);
  const [zoom, setZoom] = useState(50); // 0–100

  return (
    <footer className="h-48 bg-gray-800 border-t border-gray-700 flex flex-col shrink-0 z-20">
      {/* Timeline Toolbar */}
      <div className="h-8 bg-gray-900 border-b border-gray-700 flex items-center px-4 justify-between shrink-0">
        <div className="flex gap-4 text-xs font-bold text-gray-400">
          <span className="flex items-center gap-1">
            <Layers className="h-3 w-3" />
            Timeline
          </span>
          <span className="text-gray-600">|</span>
          <button
            onClick={() => setSnapOn(!snapOn)}
            className={`flex items-center gap-1 cursor-pointer hover:text-white transition ${
              snapOn ? "text-blue-400" : "text-gray-500"
            }`}
          >
            <Magnet className="h-3 w-3" />
            Snap: {snapOn ? "ON" : "OFF"}
          </button>
        </div>
        <div className="flex gap-2 items-center">
          <button
            onClick={() => setZoom(Math.max(0, zoom - 10))}
            className="text-gray-400 hover:text-white transition"
          >
            <Minus className="h-3 w-3" />
          </button>
          <input
            type="range"
            min={0}
            max={100}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-24 accent-blue-500 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
          />
          <button
            onClick={() => setZoom(Math.min(100, zoom + 10))}
            className="text-gray-400 hover:text-white transition"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Tracks Container */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-2 space-y-2 custom-scrollbar">
        <TimelineTrack label="Storyboard" type="storyboard" zoom={zoom} />
        <div className="border-t border-gray-700" />
        <TimelineTrack label="Video" type="video" zoom={zoom} />
      </div>
    </footer>
  );
}
