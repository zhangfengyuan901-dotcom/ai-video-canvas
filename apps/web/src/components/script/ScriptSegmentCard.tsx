// =========================================================================
// ScriptSegmentCard — 单个脚本段落卡片（可编辑、删除、移动）
// =========================================================================

import { useState, useCallback } from "react";
import type { Scene } from "@ai-video-canvas/shared";

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
    <div className="rounded border border-zinc-700/50 bg-zinc-900/40 p-3 space-y-2">
      {/* Header */}
      <div className="flex items-center gap-2 pb-1 border-b border-zinc-800">
        <span className="text-[10px] text-zinc-500 font-mono">第 {index + 1} 段</span>
        <div className="flex-1" />
        <span className="text-[10px] text-zinc-600">{scene.status}</span>
        {saving && <span className="text-[10px] text-blue-400 animate-pulse">保存中...</span>}
      </div>

      {/* Fields */}
      <div className="space-y-1.5">
        {FIELDS.map(({ key, label, type }) => {
          const value = String(scene[key] ?? "");
          return (
            <div key={key}>
              <label className="text-[10px] text-zinc-500 block mb-0.5">{label}</label>
              {type === "textarea" ? (
                <textarea
                  value={value}
                  onChange={(e) => handleChange(key, e.target.value)}
                  rows={2}
                  className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-blue-600 resize-none"
                />
              ) : (
                <input
                  type={key === "duration" ? "number" : "text"}
                  value={value}
                  onChange={(e) => handleChange(key, key === "duration" ? Number(e.target.value) : e.target.value)}
                  className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-blue-600"
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Characters */}
      <div>
        <label className="text-[10px] text-zinc-500 block mb-0.5">人物</label>
        <input
          type="text"
          value={scene.characters?.join("、") ?? ""}
          onChange={(e) => handleChange("characters", e.target.value.split("、").filter(Boolean) as any)}
          className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-blue-600"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-1 pt-1 border-t border-zinc-800">
        <button
          onClick={() => onMove(scene.id, "up")}
          disabled={index === 0}
          className="text-[10px] bg-zinc-700 hover:bg-zinc-600 disabled:opacity-30 text-zinc-300 px-1.5 py-0.5 rounded transition-colors"
        >
          上移
        </button>
        <button
          onClick={() => onMove(scene.id, "down")}
          disabled={index === totalCount - 1}
          className="text-[10px] bg-zinc-700 hover:bg-zinc-600 disabled:opacity-30 text-zinc-300 px-1.5 py-0.5 rounded transition-colors"
        >
          下移
        </button>
        <div className="flex-1" />
        <button
          onClick={() => onDelete(scene.id)}
          className="text-[10px] bg-red-800/60 hover:bg-red-700 text-red-300 px-1.5 py-0.5 rounded transition-colors"
        >
          删除
        </button>
      </div>
    </div>
  );
}