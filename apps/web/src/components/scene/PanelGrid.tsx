// =========================================================================
// PanelGrid — 三宫格故事板展示
// 显示单个镜头的 start / middle / end 三张关键帧
// =========================================================================

import { useProjectStore } from "../../stores/projectStore";
import { useEffect } from "react";
import { useApi } from "../../hooks/useApi";
import type { StoryboardPanel } from "@ai-video-canvas/shared";

interface PanelGridProps {
  sceneId: string;
}

export default function PanelGrid({ sceneId }: PanelGridProps) {
  const panels = useProjectStore((s) => s.panelsByScene[sceneId] ?? []);
  const panelsLoaded = useProjectStore((s) => !!s.panelsByScene[sceneId]);
  const isGenerating = useProjectStore((s) => s.isGeneratingStoryboard);
  const setPanels = useProjectStore((s) => s.setPanels);
  const currentProject = useProjectStore((s) => s.currentProject);
  const { post, get } = useApi();

  // Auto-load existing panels when scene first selected
  useEffect(() => {
    if (currentProject && sceneId && !panelsLoaded && !isGenerating) {
      loadPanels();
    }
  }, [currentProject?.id, sceneId]);

  // Generate storyboard for this scene
  async function handleGenerate() {
    if (!currentProject || isGenerating) return;
    const store = useProjectStore.getState();
    store.setGeneratingStoryboard(true);
    try {
      const data = await post<{ panels: StoryboardPanel[] }>(
        `/projects/${currentProject.id}/storyboard/generate`,
        { sceneIds: [sceneId] },
      );
      setPanels(sceneId, data.panels);
    } catch (err) {
      console.error("Storyboard generation failed:", err);
    } finally {
      useProjectStore.getState().setGeneratingStoryboard(false);
    }
  }

  // Load existing panels
  async function loadPanels() {
    if (!currentProject) return;
    try {
      const data = await get<StoryboardPanel[]>(
        `/projects/${currentProject.id}/scenes/${sceneId}/panels`,
      );
      setPanels(sceneId, data);
    } catch (err) {
      console.error("Failed to load panels:", err);
    }
  }

  const roles = [
    { index: 0, label: "起始帧", role: "start" },
    { index: 1, label: "中间帧", role: "middle" },
    { index: 2, label: "结束帧", role: "end" },
  ] as const;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium text-zinc-400 tracking-wide">故事板 · 三宫格</span>
        {currentProject && (
          <button
            onClick={loadPanels}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            刷新
          </button>
        )}
        <div className="flex-1" />
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !currentProject}
          className={`text-xs px-3 py-1.5 rounded font-medium transition-colors ${
            isGenerating
              ? "bg-amber-600/20 text-amber-400 animate-pulse cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-500 text-white disabled:bg-zinc-700 disabled:text-zinc-500"
          }`}
        >
          {isGenerating ? "生成中..." : panels.length > 0 ? "重新生成" : "生成故事板"}
        </button>
      </div>

      {/* Panel grid */}
      <div className="grid grid-cols-3 gap-2">
        {roles.map(({ index, label, role }) => {
          const panel = panels.find((p) => p.panelIndex === index);
          return (
            <div
              key={index}
              className="aspect-video rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden relative group"
            >
              {/* Panel label */}
              <div className="absolute top-1.5 left-1.5 z-10">
                <span className="text-[10px] bg-black/60 text-zinc-300 px-1.5 py-0.5 rounded">
                  {label}
                </span>
              </div>

              {/* Content */}
              {!panel && (
                <div className="h-full flex items-center justify-center">
                  <span className="text-xs text-zinc-600">
                    {isGenerating ? "生成中..." : "点击「生成故事板」"}
                  </span>
                </div>
              )}

              {panel?.status === "generating" && (
                <div className="h-full flex items-center justify-center">
                  <span className="text-xs text-amber-500 animate-pulse">生成中...</span>
                </div>
              )}

              {panel?.status === "failed" && (
                <div className="h-full flex items-center justify-center p-2">
                  <div className="text-center">
                    <span className="text-xs text-red-400 block">生成失败</span>
                    {panel.error && (
                      <span className="text-[10px] text-zinc-500 mt-1 block line-clamp-2">
                        {panel.error}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {panel?.status === "ready" && (
                <img
                  src={`/api/projects/${currentProject?.id}/scenes/${sceneId}/panels/${panel.panelIndex}/image`}
                  alt={`Panel ${index} (${role})`}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
