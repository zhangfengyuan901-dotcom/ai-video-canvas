// =========================================================================
// ScriptSegmentCard — 单个脚本段落卡片（可编辑、删除、移动）(redesigned)
// =========================================================================

import { useState, useCallback } from "react";
import type { Scene } from "@ai-video-canvas/shared";
import StatusBadge from "../ui/StatusBadge";
import { ChevronUp, ChevronDown, Trash2 } from "lucide-react";

interface Props {
  scene: Scene;
  index: number;
  totalCount: number;
  onFieldChange: (sceneId: string, field: string, value: string | boolean) => void;
  onDelete: (sceneId: string) => void;
  onMove: (sceneId: string, direction: "up" | "down") => void;
  projectId?: string;
}

const FIELDS: Array<{ key: keyof Scene; label: string; type: "text" | "textarea" }> = [
  { key: "title", label: "标题", type: "text" },
  { key: "scriptText", label: "分镜文本", type: "textarea" },
  { key: "visualDescription", label: "画面描述 (EN)", type: "textarea" },
  { key: "dialogue", label: "台词/旁白", type: "textarea" },
  { key: "location", label: "场景", type: "text" },
  { key: "shotSize", label: "景别", type: "text" },
  { key: "cameraMovement", label: "运镜", type: "text" },
  { key: "duration", label: "时长(秒)", type: "text" },
];

export default function ScriptSegmentCard({ scene, index, totalCount, onFieldChange, onDelete, onMove, projectId }: Props) {
  const [saving, setSaving] = useState(false);

  async function handleChange(field: keyof Scene, value: string | boolean | number | string[]) {
    setSaving(true);
    await onFieldChange(scene.id, field, value as any);
    setSaving(false);
  }

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3 transition-all hover:border-white/[0.10]">
      {/* Header */}
      <div className="flex items-center gap-2 pb-2 border-b border-white/[0.06]">
        <span className="text-[11px] text-zinc-500 font-mono font-medium">#{index + 1}</span>
        <div className="flex-1" />
        <StatusBadge status={scene.status as any} />
        {saving && <StatusBadge status="running" label="保存中..." pulse />}
      </div>

      {/* Fields */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        {FIELDS.map(({ key, label, type }) => {
          const value = String(scene[key] ?? "");
          return (
            <div key={key} className={type === "textarea" ? "col-span-2" : ""}>
              <label className="text-[10px] text-zinc-500 block mb-0.5 font-medium">{label}</label>
              {type === "textarea" ? (
                <textarea
                  value={value}
                  onChange={(e) => handleChange(key, e.target.value)}
                  rows={2}
                  className="w-full bg-zinc-800/40 border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-blue-500/40 focus:bg-zinc-800/60 resize-none transition-colors"
                />
              ) : (
                <input
                  type={key === "duration" ? "number" : "text"}
                  value={value}
                  onChange={(e) => handleChange(key, key === "duration" ? Number(e.target.value) : e.target.value)}
                  className="w-full bg-zinc-800/40 border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-blue-500/40 focus:bg-zinc-800/60 transition-colors"
                />
              )}
            </div>
          );
        })}

        {/* Characters */}
        <div className="col-span-2">
          <label className="text-[10px] text-zinc-500 block mb-0.5 font-medium">人物</label>
          <input
            type="text"
            value={scene.characters?.join("、") ?? ""}
            onChange={(e) => handleChange("characters", e.target.value.split("、").filter(Boolean) as any)}
            placeholder="用顿号分隔多个角色"
            className="w-full bg-zinc-800/40 border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-blue-500/40 focus:bg-zinc-800/60 transition-colors"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-1 pt-2 border-t border-white/[0.06]">
        <button
          onClick={() => onMove(scene.id, "up")}
          disabled={index === 0}
          className="inline-flex items-center gap-1 rounded-lg border border-white/[0.06] px-2 py-1 text-[10px] font-medium text-zinc-500 transition-all hover:bg-white/[0.04] hover:text-zinc-300 disabled:opacity-30 disabled:pointer-events-none"
        >
          <ChevronUp className="h-3 w-3" />
          上移
        </button>
        <button
          onClick={() => onMove(scene.id, "down")}
          disabled={index === totalCount - 1}
          className="inline-flex items-center gap-1 rounded-lg border border-white/[0.06] px-2 py-1 text-[10px] font-medium text-zinc-500 transition-all hover:bg-white/[0.04] hover:text-zinc-300 disabled:opacity-30 disabled:pointer-events-none"
        >
          <ChevronDown className="h-3 w-3" />
          下移
        </button>
        <div className="flex-1" />
        <button
          onClick={() => onDelete(scene.id)}
          className="inline-flex items-center gap-1 rounded-lg border border-rose-500/20 px-2 py-1 text-[10px] font-medium text-rose-400 transition-all hover:bg-rose-600/10 hover:text-rose-300"
        >
          <Trash2 className="h-3 w-3" />
          删除
        </button>
      </div>
    </div>
  );
}
