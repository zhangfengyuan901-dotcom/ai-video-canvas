// =========================================================================
// SceneList — 镜头列表展示
// =========================================================================

import { useProjectStore } from "../../stores/projectStore";
import { useApi } from "../../hooks/useApi";
import PanelGrid from "./PanelGrid";
import SceneInspector from "./SceneInspector";
import { useCallback, useState } from "react";

export default function SceneList() {
  const api = useApi();
  const scenes = useProjectStore((s) => s.scenes);
  const selectedSceneId = useProjectStore((s) => s.selectedSceneId);
  const selectScene = useProjectStore((s) => s.selectScene);
  const setScenes = useProjectStore((s) => s.setScenes);
  const [savingId, setSavingId] = useState<string | null>(null);

  const handleFieldChange = useCallback(
    async (sceneId: string, field: string, value: string | boolean) => {
      setSavingId(sceneId);
      setScenes(
        scenes.map((s) => (s.id === sceneId ? { ...s, [field]: value } : s)),
      );
      try {
        await api.patch(`/scenes/${sceneId}`, { [field]: value });
      } catch (err) {
        console.error("Failed to update scene:", err);
      } finally {
        setSavingId(null);
      }
    },
    [scenes, setScenes, api],
  );

  if (scenes.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-zinc-600 text-sm">还没有镜头</p>
        <p className="text-zinc-700 text-xs mt-1">
          在左侧聊天框输入创意，点击"生成"创建镜头脚本
        </p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-sm font-medium text-zinc-400 mb-3">
        镜头列表 · {scenes.length} 个镜头
      </h3>
      <div className="grid gap-3 grid-cols-1 lg:grid-cols-2">
        {scenes.map((scene) => {
          const isSelected = selectedSceneId === scene.id;
          return (
            <div
              key={scene.id}
              onClick={() => selectScene(isSelected ? null : scene.id)}
              className={`rounded-lg border p-4 cursor-pointer transition-colors ${
                isSelected
                  ? "border-blue-600 bg-blue-600/5"
                  : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-zinc-500 font-mono">#{scene.order}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded ${
                    scene.status === "draft"
                      ? "bg-zinc-800 text-zinc-500"
                      : scene.status === "storyboard_ready"
                        ? "bg-green-600/20 text-green-400"
                        : scene.status === "video_ready"
                          ? "bg-blue-600/20 text-blue-400"
                          : "bg-zinc-800 text-zinc-500"
                  }`}
                >
                  {scene.status}
                </span>
              </div>

              <h4 className="font-medium text-zinc-200 text-sm mb-1">{scene.title}</h4>
              <p className="text-xs text-zinc-500 line-clamp-2 mb-2">{scene.summary}</p>

              {/* Meta */}
              <div className="flex flex-wrap gap-1.5">
                {scene.shotSize && (
                  <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">
                    {scene.shotSize}
                  </span>
                )}
                {scene.cameraMovement && (
                  <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">
                    {scene.cameraMovement}
                  </span>
                )}
                {scene.location && (
                  <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">
                    {scene.location}
                  </span>
                )}
                <span className="text-[10px] bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded">
                  {scene.duration}s
                </span>
              </div>

              {/* Visual desc preview */}
              {scene.visualDescription && (
                <p className="text-[10px] text-zinc-600 mt-2 line-clamp-1 italic">
                  {scene.visualDescription}
                </p>
              )}
              {/* PanelGrid for selected scene */}
              {isSelected && (
                <>
                  <PanelGrid sceneId={scene.id} />
                  <details className="mt-4" open>
                    <summary className="text-xs text-zinc-500 cursor-pointer select-none hover:text-zinc-400 font-medium tracking-wide">
                      镜头编辑器 ▼
                    </summary>
                    <div className="mt-2">
                      <SceneInspector scene={scene} />
                    </div>
                  </details>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
