// =========================================================================
// PanelGrid — 三宫格故事板展示 (redesigned)
// 显示单个镜头的 start / middle / end 三张关键帧
// =========================================================================

import { useProjectStore } from "../../stores/projectStore";
import { useEffect, useState } from "react";
import { useApi } from "../../hooks/useApi";
import StatusBadge from "../ui/StatusBadge";
import GradientButton from "../ui/GradientButton";
import { ImagePlus, RefreshCw, Upload, X, Check, X as XIcon } from "lucide-react";
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

  // Restore running job + auto-refresh panels during generation
  useEffect(() => {
    if (!currentProject) return;
    let cancelled = false;

    async function check() {
      try {
        // Find any running storyboard job
        const jobs = await get<any[]>(`/projects/${currentProject!.id}/jobs`);
        const runningJob = jobs.find(
          (j) => j.type === "STORYBOARD_GENERATE" && (j.status === "queued" || j.status === "running"),
        );
        if (runningJob) {
          if (runningJob.id !== jobId) {
            setJobId(runningJob.id);
            useProjectStore.getState().setGeneratingStoryboard(true);
          }
          setJobProgress(runningJob.progress ?? 0);
        } else if (isGeneratingGlob) {
          // No running job found but store thinks it's generating — clear it
          useProjectStore.getState().setGeneratingStoryboard(false);
          setJobId(null);
        }

        // Always refresh panels to catch updates (e.g. RunningHub fallback progress)
        if (!cancelled) {
          await loadPanelsSilent();
        }
      } catch { /* silent */ }
    }

    check(); // Run immediately
    const interval = setInterval(check, 3000); // Poll every 3s
    return () => { cancelled = true; clearInterval(interval); };
  }, [currentProject?.id, sceneId]);

  // Silent panel loader — doesn't set generating flags
  async function loadPanelsSilent() {
    if (!currentProject) return;
    try {
      const data = await get<StoryboardPanel[]>(
        `/projects/${currentProject.id}/scenes/${sceneId}/panels`,
      );
      setPanels(sceneId, data);
    } catch { /* silent */ }
  }

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
        <span className="text-xs font-medium text-gray-400 tracking-wide">三图素材</span>
        {currentProject && (
          <button
            onClick={async () => { await loadPanelsSilent(); }}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-700 px-1.5 py-0.5 text-[10px] font-medium text-gray-400 transition-all hover:bg-gray-600 hover:text-gray-200 active:bg-gray-700"
          >
            <RefreshCw className="h-3 w-3" />
            刷新
          </button>
        )}
        <div className="flex-1" />
        <button
          onClick={handleGenerate}
          disabled={isGeneratingGlob || !currentProject}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-medium transition-all ${
            isGeneratingGlob
              ? "bg-amber-600/20 text-amber-400 animate-pulse cursor-not-allowed"
              : "bg-gradient-to-b from-blue-500 to-blue-600 text-white shadow-sm shadow-blue-500/20 hover:from-blue-400 hover:to-blue-500 disabled:opacity-40 disabled:pointer-events-none"
          }`}
        >
          <ImagePlus className="h-3 w-3" />
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
              className="aspect-video rounded-xl border border-gray-700 bg-gray-800/60 overflow-hidden relative group"
            >
              {/* Image content */}
              {panel?.status === "ready" ? (
                <img
                  src={`/api/projects/${currentProject?.id}/scenes/${sceneId}/panels/${panel.panelIndex}/image?v=${panel.version}`}
                  alt={`Panel ${index} (${role})`}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : panel?.status === "generating" ? (
                <div className="h-full flex flex-col items-center justify-center gap-1 px-2">
                  <StatusBadge status="running" label="生成中..." pulse />
                  {panel.error && (
                    <p className="text-[8px] text-blue-400 text-center leading-tight line-clamp-2">
                      {panel.error.replace(/^\[生成中\]\s*/, "")}
                    </p>
                  )}
                  {jobProgress > 0 && (
                    <div className="w-16 h-1 bg-gray-700 rounded-full mt-1">
                      <div className="h-1 bg-blue-500 rounded-full transition-all" style={{ width: `${jobProgress}%` }} />
                    </div>
                  )}
                </div>
              ) : panel?.status === "failed" ? (
                <div className="h-full flex items-center justify-center p-3">
                  <div className="text-center">
                    <StatusBadge status="failed" />
                    {panel.error && (
                      <p className="text-[9px] text-gray-500 mt-1 line-clamp-2">{panel.error}</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center gap-1">
                  <span className="text-[10px] text-gray-500">
                    {isGeneratingGlob ? "排队中..." : "点击生成"}
                  </span>
                  {isGeneratingGlob && jobProgress > 0 && (
                    <div className="w-12 h-0.5 bg-gray-700 rounded-full">
                      <div className="h-0.5 bg-blue-500 rounded-full transition-all" style={{ width: `${jobProgress}%` }} />
                    </div>
                  )}
                </div>
              )}

              {/* Panel label */}
              <div className="absolute top-1.5 left-1.5 z-10">
                <span className="text-[10px] bg-black/60 text-gray-300 px-1.5 py-0.5 rounded-md backdrop-blur-sm leading-none">
                  {label}
                </span>
              </div>

              {/* Upload/clear overlay */}
              <div className="absolute inset-x-1 bottom-1 z-20 hidden group-hover:flex gap-1 justify-center">
                <label className="inline-flex items-center gap-1 rounded-md bg-black/70 backdrop-blur-sm text-gray-300 px-2 py-1 text-[10px] cursor-pointer transition-colors hover:bg-black/90 hover:text-white">
                  <Upload className="h-2.5 w-2.5" />
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
                    onClick={(e) => { e.stopPropagation(); handleClear(index); }}
                    disabled={clearingPanel !== null}
                    className="inline-flex items-center gap-1 rounded-md bg-black/70 backdrop-blur-sm text-rose-300 px-2 py-1 text-[10px] transition-colors hover:bg-black/90 hover:text-rose-200 disabled:opacity-50"
                  >
                    <X className="h-2.5 w-2.5" />
                    {clearingPanel === index ? "取消中..." : "取消"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Storyboard Review Controls — 三张全部 ready 时才显示审核通过，否则只显示驳回 */}
      {currentProject && panels.length > 0 && (
        <div className="flex items-center gap-2 pt-1">
          <span className="text-[10px] text-gray-500">故事板审核：</span>
          {panels.filter(p => p.status === "ready" && p.localPath).length === 3 ? (
            <button
              onClick={async (e) => {
                e.stopPropagation();
                try {
                  await patch(`/projects/${currentProject.id}/scenes/${sceneId}/storyboard-review`, { status: "approved" });
                  await loadPanels();
                  const scs = await get<Scene[]>(`/projects/${currentProject.id}/scenes`);
                  useProjectStore.getState().setScenes(scs);
                  window.dispatchEvent(new CustomEvent('toast', { detail: { message: '故事板审核已通过', type: 'success' } }));
                } catch (err) {
                  const msg = err instanceof Error ? err.message : "审核失败";
                  window.dispatchEvent(new CustomEvent('toast', { detail: { message: msg, type: 'error' } }));
                }
              }}
              className="inline-flex items-center gap-1 rounded-md bg-emerald-600/80 hover:bg-emerald-600 text-white px-2 py-1 text-[10px] font-medium transition-colors"
            >
              <Check className="h-3 w-3" />
              审核通过
            </button>
          ) : (
            <span className="text-[10px] text-gray-600">
              {panels.some(p => p.status === "generating") ? "图片生成中，完成后可审核..." : "三张图片未全部就绪"}
            </span>
          )}
          <button
            onClick={async (e) => {
              e.stopPropagation();
              try {
                await patch(`/projects/${currentProject.id}/scenes/${sceneId}/storyboard-review`, { status: "rejected", note: "用户驳回" });
                await loadPanels();
                const scs = await get<Scene[]>(`/projects/${currentProject.id}/scenes`);
                useProjectStore.getState().setScenes(scs);
                window.dispatchEvent(new CustomEvent('toast', { detail: { message: '故事板已驳回', type: 'info' } }));
              } catch (err) {
                const msg = err instanceof Error ? err.message : "驳回失败";
                window.dispatchEvent(new CustomEvent('toast', { detail: { message: msg, type: 'error' } }));
              }
            }}
            className="inline-flex items-center gap-1 rounded-md bg-rose-600/80 hover:bg-rose-600 text-white px-2 py-1 text-[10px] font-medium transition-colors"
          >
            <XIcon className="h-3 w-3" />
            驳回
          </button>
        </div>
      )}
    </div>
  );
}
