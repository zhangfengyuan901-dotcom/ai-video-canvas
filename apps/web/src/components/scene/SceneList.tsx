// =========================================================================
// SceneList — 镜头列表展示
// =========================================================================

import { useProjectStore } from "../../stores/projectStore";
import { useApi } from "../../hooks/useApi";
import SceneCard from "./SceneCard";
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
            <SceneCard
              key={scene.id}
              scene={scene}
              isSelected={isSelected}
              saving={savingId === scene.id}
              onSelect={() => selectScene(isSelected ? null : scene.id)}
              onFieldChange={handleFieldChange}
            />
          );
        })}
      </div>
    </div>
  );
}
