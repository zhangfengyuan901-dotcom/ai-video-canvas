// =========================================================================
// ScriptPreviewPanel — 脚本创建预览区 + 编辑/增删/排序 + 一键生成故事板 (redesigned)
// =========================================================================

import { useState, useEffect, useCallback } from "react";
import { useProjectStore } from "../../stores/projectStore";
import { useApi } from "../../hooks/useApi";
import GlassPanel from "../ui/GlassPanel";
import SectionHeader from "../ui/SectionHeader";
import GradientButton from "../ui/GradientButton";
import StatusBadge from "../ui/StatusBadge";
import LoadingState from "../ui/LoadingState";
import ScriptSegmentCard from "./ScriptSegmentCard";
import { ImagePlus, Plus, AlertCircle } from "lucide-react";
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
    <GlassPanel className="p-4 space-y-4">
      <SectionHeader
        title="脚本预览"
        count={scenes.length}
        subtitle="编辑、增删和排序段落，确认后生成故事板"
        action={
          <div className="flex gap-2">
            <button
              onClick={handleAddSegment}
              className="inline-flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[11px] font-medium text-zinc-400 transition-all hover:bg-white/[0.06] hover:text-zinc-300"
            >
              <Plus className="h-3 w-3" />
              添加段落
            </button>
            <button
              onClick={handleGenerateStoryboard}
              disabled={scenes.length === 0 || isGeneratingStoryboard}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-b from-violet-500 to-violet-600 text-white px-3 py-1.5 text-[11px] font-medium transition-all hover:from-violet-400 hover:to-violet-500 active:from-violet-600 active:to-violet-700 disabled:opacity-40 disabled:pointer-events-none shadow-sm shadow-violet-500/20"
            >
              <ImagePlus className="h-3.5 w-3.5" />
              {isGeneratingStoryboard ? `生成中... ${jobProgress}%` : "生成故事板"}
            </button>
          </div>
        }
      />

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-xs text-rose-400 bg-rose-600/10 border border-rose-500/10 rounded-xl px-3 py-2">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Loading */}
      {isGeneratingStoryboard && (
        <LoadingState variant="pulse" message={`正在生成故事板图片... ${jobProgress}%`} />
      )}

      {/* Scene segments */}
      {scenes.length === 0 ? (
        <div className="text-xs text-zinc-500 py-4 text-center">
          暂无脚本段落，请先在「脚本输入」区创建脚本
        </div>
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
    </GlassPanel>
  );
}
