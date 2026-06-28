// =========================================================================
// SceneList — 镜头列表展示 (simplified overview grid)
// =========================================================================

import { useProjectStore } from "../../stores/projectStore";
import { useState } from "react";
import SceneCard from "./SceneCard";
import GlassPanel from "../ui/GlassPanel";
import EmptyState from "../ui/EmptyState";
import { Film } from "lucide-react";

export default function SceneList() {
  const scenes = useProjectStore((s) => s.scenes);
  const selectedSceneId = useProjectStore((s) => s.selectedSceneId);
  const selectScene = useProjectStore((s) => s.selectScene);
  const setScenes = useProjectStore((s) => s.setScenes);
  const [savingId, setSavingId] = useState<string | null>(null);

  if (scenes.length === 0) {
    return (
      <GlassPanel className="p-4">
        <EmptyState
          compact
          icon={<Film className="h-6 w-6" />}
          title="No shots yet"
          message="Describe your idea on the left and click 'Create Script' to generate shots"
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
            />
          );
        })}
      </div>
    </div>
  );
}
