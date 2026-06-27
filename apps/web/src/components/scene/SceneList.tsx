// =========================================================================
// SceneList — 镜头列表展示 (redesigned)
// =========================================================================

import { useProjectStore } from "../../stores/projectStore";
import { useApi } from "../../hooks/useApi";
import SceneCard from "./SceneCard";
import { useCallback, useState } from "react";
import GlassPanel from "../ui/GlassPanel";
import SectionHeader from "../ui/SectionHeader";
import EmptyState from "../ui/EmptyState";
import { Film } from "lucide-react";

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
      <GlassPanel className="p-4">
        <EmptyState
          compact
          icon={<Film className="h-6 w-6" />}
          title="还没有镜头"
          message="在左侧输入创意，点击「创建脚本」即可生成分镜脚本"
        />
      </GlassPanel>
    );
  }

  return (
    <div>
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
