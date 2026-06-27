// =========================================================================
// PanelGrid — 三宫格故事板展示
// 显示单个镜头的 start / middle / end 三张关键帧
// =========================================================================

import { useProjectStore } from "../../stores/projectStore";
import { useEffect, useState } from "react";
import { useApi } from "../../hooks/useApi";
import type { StoryboardPanel, Scene } from "@ai-video-canvas/shared";

interface PanelGridProps {
  sceneId: string;
}

export default function PanelGrid({ sceneId }: PanelGridProps) {
  const panels = useProjectStore((s) => s.panelsByScene[sceneId] ?? []);
  const panelsLoaded = useProjectStore((s) => !!s.panelsByScene[sceneId]);
  const isGeneratingGlob = useProjectStore((s) => s.isGeneratingStoryboard);
  const setPanels = useProjectStore((s) => s.setPanels);
  const currentProject = useProjectStore((s) => s.currentProject);
  const { post, get, patch } = useApi();

  const [jobId, setJobId] = useState<string | null>(null);
  const [jobProgress, setJobProgress] = useState<number>(0);
  const [uploadingPanel, setUploadingPanel] = useState<number | null>(null);
  const [clearingPanel, setClearingPanel] = useState<number | null>(null);

  // Auto-load existing panels when scene first selected
  useEffect(() => {
    if (currentProject && sceneId && !panelsLoaded && !isGeneratingGlob) {
      loadPanels();
    }
  }, [currentProject?.id, sceneId]);

  // Restore running job on page refresh
  useEffect(() => {
    if (!currentProject) return;
    (async () => {
      try {
        const jobs = await get<any[]>(`/projects/${currentProject.id}/jobs`);
        const runningJob = jobs.find(
          (j) => j.type === "STORYBOARD_GENERATE" && (j.status === "queued" || j.status === "running"),
        );
        if (runningJob && runningJob.id !== jobId) {
          setJobId(runningJob.id);
          setJobProgress(runningJob.progress ?? 0);
          useProjectStore.getState().setGeneratingStoryboard(true);
        }
      } catch {
        // silent
      }
    })();
  }, [currentProject?.id]);

  // Poll job status when a job is running
  useEffect(() => {
    if (!jobId || !currentProject) return;
    const projectId = currentProject.id;
    const poll = setInterval(async () => {
      try {
        const job = await get<{ status: string; progress: number; error?: string }>(`/jobs/${jobId}`);
        setJobProgress(job.progress);
        if (job.status === "success") {
          setJobId(null);
          useProjectStore.getState().setGeneratingStoryboard(false);
          loadPanels();
        } else if (job.status === "failed") {
          setJobId(null);
          console.error("Storyboard job failed:", job.error);
          useProjectStore.getState().setGeneratingStoryboard(false);
        } else if (job.status === "cancelled") {
          setJobId(null);
          console.log("Storyboard job was cancelled");
          useProjectStore.getState().setGeneratingStoryboard(false);
        }
      } catch {
        setJobId(null);
        useProjectStore.getState().setGeneratingStoryboard(false);
      }
    }, 2000);
    return () => clearInterval(poll);
  }, [jobId, currentProject?.id]);

  // Generate storyboard for this scene
  async function handleGenerate() {
    if (!currentProject || isGeneratingGlob) return;
    useProjectStore.getState().setGeneratingStoryboard(true);
    setJobProgress(0);
    try {
      const data = await post<{ jobId: string }>(
        `/projects/${currentProject.id}/storyboard/generate`,
        { sceneIds: [sceneId] },
      );
      setJobId(data.jobId);
    } catch (err) {
      console.error("Storyboard generation failed:", err);
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

  // Upload a panel image
  async function handleUpload(panelIndex: number, file: File | undefined) {
    if (!file || !currentProject) return;
    setUploadingPanel(panelIndex);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(
        `/api/projects/${currentProject.id}/scenes/${sceneId}/panels/${panelIndex}/upload`,
        { method: "POST", body: formData },
      );
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "上传失败");
      await loadPanels();
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploadingPanel(null);
    }
  }

  // Clear a panel image
  async function handleClear(panelIndex: number) {
    if (!currentProject) return;
    setClearingPanel(panelIndex);
    try {
      const res = await fetch(
        `/api/projects/${currentProject.id}/scenes/${sceneId}/panels/${panelIndex}`,
        { method: "DELETE" },
      );
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "取消失败");
      await loadPanels();
    } catch (err) {
      console.error("Clear failed:", err);
    } finally {
      setClearingPanel(null);
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
        <span className="text-xs font-medium text-zinc-400 tracking-wide">三图素材</span>
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
          disabled={isGeneratingGlob || !currentProject}
          className={`text-xs px-3 py-1.5 rounded font-medium transition-colors ${
            isGeneratingGlob
              ? "bg-amber-600/20 text-amber-400 animate-pulse cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-500 text-white disabled:bg-zinc-700 disabled:text-zinc-500"
          }`}
        >
          {isGeneratingGlob ? `生成中... ${jobProgress}%` : panels.length > 0 ? "重生三图" : "生成三图"}
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
              {/* Upload/clear overlay */}
              <div className="absolute bottom-1 left-1 right-1 z-20 hidden group-hover:flex gap-1 justify-center">
                <label className="text-[10px] bg-black/70 hover:bg-black text-white px-1.5 py-0.5 rounded cursor-pointer transition-colors">
                  {uploadingPanel === index ? "上传中..." : "上传"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    disabled={uploadingPanel !== null}
                    onChange={(e) => handleUpload(index, e.target.files?.[0])}
                  />
                </label>

                {panel?.status === "ready" && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClear(index);
                    }}
                    disabled={clearingPanel !== null}
                    className="text-[10px] bg-red-700/80 hover:bg-red-600 text-white px-1.5 py-0.5 rounded transition-colors disabled:opacity-50"
                  >
                    {clearingPanel === index ? "取消中..." : "取消"}
                  </button>
                )}
              </div>

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
                    {isGeneratingGlob ? "生成中..." : "点击「生成三图」"}
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
                  src={`/api/projects/${currentProject?.id}/scenes/${sceneId}/panels/${panel.panelIndex}/image?v=${panel.version}`}
                  alt={`Panel ${index} (${role})`}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              )}
            </div>
          );
        })}
      </div>
      {/* Storyboard Review Controls */}
      {panels.filter(p => p.status === "ready" && p.localPath).length === 3 && currentProject && (
        <div className="flex items-center gap-2 pt-1">
          <span className="text-[10px] text-zinc-500">故事板审核：</span>
          <button
            onClick={async (e) => {
              e.stopPropagation();
              try {
                await patch(`/projects/${currentProject.id}/scenes/${sceneId}/storyboard-review`, { status: "approved" });
                await loadPanels();
                if (currentProject) {
                  const scenes = await get<Scene[]>(`/projects/${currentProject.id}/scenes`);
                  useProjectStore.getState().setScenes(scenes);
                }
              } catch (err) {
                console.error("Storyboard approve failed:", err);
              }
            }}
            className="text-[10px] bg-green-700 hover:bg-green-600 text-white px-2 py-0.5 rounded transition-colors"
          >
            审核通过
          </button>
          <button
            onClick={async (e) => {
              e.stopPropagation();
              try {
                await patch(`/projects/${currentProject.id}/scenes/${sceneId}/storyboard-review`, { status: "rejected", note: "用户驳回" });
                await loadPanels();
                if (currentProject) {
                  const scenes = await get<Scene[]>(`/projects/${currentProject.id}/scenes`);
                  useProjectStore.getState().setScenes(scenes);
                }
              } catch (err) {
                console.error("Storyboard reject failed:", err);
              }
            }}
            className="text-[10px] bg-red-700 hover:bg-red-600 text-white px-2 py-0.5 rounded transition-colors"
          >
            驳回
          </button>
        </div>
      )}

    </div>
  );
}
