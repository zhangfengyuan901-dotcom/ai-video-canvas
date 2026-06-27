// =========================================================================
// ScriptPreviewPanel — 脚本创建预览区 + 编辑/增删/排序 + 一键生成故事板
// =========================================================================

import { useState, useEffect, useCallback } from "react";
import { useProjectStore } from "../../stores/projectStore";
import { useApi } from "../../hooks/useApi";
import ScriptSegmentCard from "./ScriptSegmentCard";
import type { Scene } from "@ai-video-canvas/shared";

export default function ScriptPreviewPanel() {
  const { post, get, patch } = useApi();
  const { currentProject, scenes, setScenes, isGeneratingStoryboard, setGeneratingStoryboard, panelsByScene, setPanels } = useProjectStore();
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobProgress, setJobProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Reload scenes
  const loadScenes = useCallback(async () => {
    if (!currentProject) return;
    try {
      const list = await get<Scene[]>(`/projects/${currentProject.id}/scenes`);
      setScenes(list as any);
    } catch {}
  }, [currentProject?.id, get, setScenes]);

  // Poll job status
  useEffect(() => {
    if (!jobId) return;
    const poll = setInterval(async () => {
      try {
        const job = await get<{ status: string; progress: number; error?: string }>(`/jobs/${jobId}`);
        setJobProgress(job.progress);
        if (job.status === "success") {
          setJobId(null);
          setGeneratingStoryboard(false);
          await loadScenes();
          // Reload panels for all scenes
          if (currentProject) {
            for (const scene of scenes) {
              const panels = await get<any[]>(`/projects/${currentProject.id}/scenes/${scene.id}/panels`);
              setPanels(scene.id, panels);
            }
          }
        } else if (job.status === "failed" || job.status === "cancelled") {
          setJobId(null);
          setGeneratingStoryboard(false);
          setError(job.error ?? "Storyboard generation failed");
        }
      } catch {
        setJobId(null);
        setGeneratingStoryboard(false);
      }
    }, 2000);
    return () => clearInterval(poll);
  }, [jobId, currentProject?.id, get, scenes, setGeneratingStoryboard]);

  // Generate all storyboards
  async function handleGenerateStoryboard() {
    if (!currentProject || scenes.length === 0 || isGeneratingStoryboard) return;
    setError(null);
    setGeneratingStoryboard(true);
    setJobProgress(0);
    try {
      const data = await post<{ jobId: string }>(
        `/projects/${currentProject.id}/storyboard/generate`,
        {},
      );
      setJobId(data.jobId);
    } catch (err) {
      setGeneratingStoryboard(false);
      setError(err instanceof Error ? err.message : "Generation failed");
    }
  }

  // Update scene field
  async function handleFieldChange(sceneId: string, field: string, value: string | boolean) {
    setScenes(scenes.map((s) => (s.id === sceneId ? { ...s, [field]: value } : s)));
    try {
      await patch(`/scenes/${sceneId}`, { [field]: value });
    } catch {}
  }

  // Add empty scene
  async function handleAddSegment() {
    if (!currentProject) return;
    try {
      await post(`/projects/${currentProject.id}/scenes`, {});
      await loadScenes();
    } catch {}
  }

  // Delete scene
  async function handleDeleteSegment(sceneId: string) {
    if (!currentProject) return;
    const scene = scenes.find((s) => s.id === sceneId);
    if (scene && (scene.status !== "draft" && scene.status !== "failed")) {
      if (!confirm("该镜头已有故事板或视频，确定删除？")) return;
    }
    try {
      await fetch(`/api/scenes/${sceneId}`, { method: "DELETE" });
      await loadScenes();
    } catch {}
  }

  // Move scene up/down
  async function handleMoveScene(sceneId: string, direction: "up" | "down") {
    const sorted = [...scenes].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((s) => s.id === sceneId);
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === sorted.length - 1) return;

    const newOrder = [...sorted];
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];
    const sceneIds = newOrder.map((s) => s.id);

    try {
      await post("/scenes/reorder", { sceneIds });
      await loadScenes();
    } catch {}
  }

  if (!currentProject) return null;

  const sortedScenes = [...scenes].sort((a, b) => a.order - b.order);

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-300">
          脚本预览 {scenes.length > 0 && <span className="text-zinc-500 font-normal">· {scenes.length} 段</span>}
        </h3>
        <div className="flex gap-2">
          <button
            onClick={handleAddSegment}
            className="text-[10px] bg-zinc-700 hover:bg-zinc-600 text-zinc-300 px-2 py-1 rounded transition-colors"
          >
            + 添加段落
          </button>
          <button
            onClick={handleGenerateStoryboard}
            disabled={scenes.length === 0 || isGeneratingStoryboard}
            className="text-[10px] bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white px-2 py-1 rounded font-medium transition-colors"
          >
            {isGeneratingStoryboard ? `生成中... ${jobProgress}%` : "生成故事板图片"}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && <p className="text-xs text-red-400">{error}</p>}

      {/* Scene segments */}
      {scenes.length === 0 ? (
        <p className="text-xs text-zinc-500 py-4 text-center">暂无脚本段落，请先在"脚本输入"区创建脚本。</p>
      ) : (
        <div className="space-y-2">
          {sortedScenes.map((scene, idx) => (
            <ScriptSegmentCard
              key={scene.id}
              scene={scene}
              index={idx}
              totalCount={sortedScenes.length}
              onFieldChange={handleFieldChange}
              onDelete={handleDeleteSegment}
              onMove={handleMoveScene}
              projectId={currentProject?.id}
            />
          ))}
        </div>
      )}
    </section>
  );
}