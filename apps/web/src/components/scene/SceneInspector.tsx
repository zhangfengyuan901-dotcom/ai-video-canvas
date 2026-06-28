// =========================================================================
// SceneInspector — 镜头编辑面板
// 允许编辑镜头字段并保存到后端
// =========================================================================

import { useCallback, useState } from "react";
import { useProjectStore } from "../../stores/projectStore";
import { useApi } from "../../hooks/useApi";
import type { Scene } from "@ai-video-canvas/shared";

interface Props {
  scene: Scene;
}

const FIELDS: Array<{
  key: keyof Scene;
  label: string;
  type: "text" | "textarea" | "select";
  options?: string[];
}> = [
  { key: "title", label: "标题", type: "text" },
  { key: "summary", label: "概要", type: "textarea" },
  { key: "scriptText", label: "分镜文本", type: "textarea" },
  { key: "visualDescription", label: "画面描述 (EN)", type: "textarea" },
  { key: "shotSize", label: "景别", type: "text" },
  { key: "cameraAngle", label: "机位", type: "text" },
  { key: "cameraMovement", label: "运镜", type: "text" },
  { key: "motionPrompt", label: "动态提示 (EN)", type: "textarea" },
  { key: "location", label: "场景/地点", type: "text" },
  { key: "dialogue", label: "对白", type: "textarea" },
  { key: "audioEffects", label: "音效", type: "text" },
];

export default function SceneInspector({ scene }: Props) {
  const api = useApi();
  const setScenes = useProjectStore((s) => s.setScenes);
  const scenes = useProjectStore((s) => s.scenes);
  const [saving, setSaving] = useState(false);

  const handleChange = useCallback(
    async (field: keyof Scene, value: string) => {
      setSaving(true);
      setScenes(
        scenes.map((s) => (s.id === scene.id ? { ...s, [field]: value } : s)),
      );
      try {
        await api.patch(`/scenes/${scene.id}`, { [field]: value });
      } catch (err) {
        console.error("Failed to update scene:", err);
      } finally {
        setSaving(false);
      }
    },
    [scene.id, scenes, setScenes, api],
  );

  return (
    <div className="space-y-2 text-xs">
      {saving && (
        <div className="text-[10px] text-blue-400 animate-pulse">保存中...</div>
      )}
      {FIELDS.map(({ key, label, type }) => {
        const value = (scene[key] ?? "") as string;
        return (
          <div key={key}>
            <label className="block text-gray-500 mb-0.5">{label}</label>
            {type === "textarea" ? (
              <textarea
                value={value}
                onChange={(e) => handleChange(key, e.target.value)}
                rows={2}
                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-600 resize-none"
              />
            ) : (
              <input
                type="text"
                value={value}
                onChange={(e) => handleChange(key, e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-600"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
