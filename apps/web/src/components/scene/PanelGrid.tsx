// =========================================================================
// PanelGrid — 三宫格故事板展示
// =========================================================================

import { useProjectStore } from "../../stores/projectStore";
import { useEffect, useState, useRef, useCallback } from "react";
import { useApi } from "../../hooks/useApi";
import StatusBadge from "../ui/StatusBadge";
import { ImagePlus, RefreshCw, Upload, X, Check, X as XIcon } from "lucide-react";
import type { StoryboardPanel, Scene } from "@ai-video-canvas/shared";

interface PanelGridProps {
  sceneId: string;
}

export default function PanelGrid({ sceneId }: PanelGridProps) {
  const panels = useProjectStore((s) => s.panelsByScene[sceneId] ?? []);
  const setPanels = useProjectStore((s) => s.setPanels);
  const currentProject = useProjectStore((s) => s.currentProject);
  const { post, get, patch } = useApi();

  const [jobProgress, setJobProgress] = useState<number>(0);
  const [uploadingPanel, setUploadingPanel] = useState<number | null>(null);
  const [clearingPanel, setClearingPanel] = useState<number | null>(null);
  const jobIdRef = useRef<string | null>(null);
  const cancelledRef = useRef(false);

  // ---- 核心：单一 3s 轮询（panel 数据 + job 状态）-------------------------
  useEffect(() => {
    if (!currentProject) return;
    cancelledRef.current = false;

    async function tick() {
      if (cancelledRef.current) return;
      try {
        // 1) 始终刷新 panel 数据
        const data = await get<StoryboardPanel[]>(
          `/projects/${currentProject!.id}/scenes/${sceneId}/panels`,
        );
        setPanels(sceneId, data);

        // 2) 检查是否有活跃的 storyboard job
        const jobs = await get<any[]>(`/projects/${currentProject!.id}/jobs`);
        const running = jobs.find(
          (j: any) => j.type === "STORYBOARD_GENERATE" && (j.status === "queued" || j.status === "running"),
        );

        const store = useProjectStore.getState();
        if (running) {
          jobIdRef.current = running.id;
          setJobProgress(running.progress ?? 0);
          if (!store.isGeneratingStoryboard) store.setGeneratingStoryboard(true);
        } else {
          // No active job — check if panels are all ready to determine state
          const latest = store.panelsByScene[sceneId] ?? data;
          const readyCount = latest.filter((p: StoryboardPanel) => p.status === "ready").length;
          if (readyCount < 3 && jobIdRef.current) {
            // Job was running but disappeared — might have failed; keep watching
          } else {
            // All done or no job ever started
            jobIdRef.current = null;
            if (store.isGeneratingStoryboard) store.setGeneratingStoryboard(false);
          }
        }
      } catch { /* network error — will retry next tick */ }
    }

    tick();
    const interval = setInterval(tick, 3000);
    return () => { cancelledRef.current = true; clearInterval(interval); };
  }, [currentProject?.id, sceneId, get, setPanels]);

  // Derive generating flag from store (reactive)
  const isGeneratingGlob = useProjectStore((s) => s.isGeneratingStoryboard);

  // ---- 生成 ----------------------------------------------------------------
  async function handleGenerate() {
    if (!currentProject || isGeneratingGlob) return;
    useProjectStore.getState().setGeneratingStoryboard(true);
    setJobProgress(0);
    try {
      const data = await post<{ jobId: string }>(
        `/projects/${currentProject.id}/storyboard/generate`,
        { sceneIds: [sceneId] },
      );
      jobIdRef.current = data.jobId;
    } catch (err) {
      console.error("Storyboard generation failed:", err);
      useProjectStore.getState().setGeneratingStoryboard(false);
    }
  }

  // ---- 上传 / 清除 ---------------------------------------------------------
  async function handleUpload(panelIndex: number, file: File | undefined) {
    if (!file || !currentProject) return;
    setUploadingPanel(panelIndex);
    try {
      const formData = new FormData();
      formData.append("file", file);
      await fetch(`/api/projects/${currentProject.id}/scenes/${sceneId}/panels/${panelIndex}/upload`, {
        method: "POST", body: formData,
      });
    } catch (err) { console.error("Upload failed:", err); }
    finally { setUploadingPanel(null); }
  }

  async function handleClear(panelIndex: number) {
    if (!currentProject) return;
    setClearingPanel(panelIndex);
    try {
      await fetch(`/api/projects/${currentProject.id}/scenes/${sceneId}/panels/${panelIndex}`, {
        method: "DELETE",
      });
    } catch (err) { console.error("Clear failed:", err); }
    finally { setClearingPanel(null); }
  }

  const roles = [
    { index: 0, label: "起始帧", role: "start" },
    { index: 1, label: "中间帧", role: "middle" },
    { index: 2, label: "结束帧", role: "end" },
  ] as const;

  const readyCount = panels.filter(p => p.status === "ready" && p.localPath).length;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium text-gray-400 tracking-wide">三图素材</span>
        {currentProject && (
          <button
            onClick={async () => {
              const data = await get<StoryboardPanel[]>(`/projects/${currentProject.id}/scenes/${sceneId}/panels`);
              setPanels(sceneId, data);
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-600 px-1.5 py-0.5 text-[10px] font-medium text-gray-400 hover:bg-gray-600 hover:text-gray-200 transition"
          >
            <RefreshCw className="h-3 w-3" /> 刷新
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
          {isGeneratingGlob ? (
            jobIdRef.current ? `生成中... ${jobProgress}%` : "生成中..."
          ) : panels.length > 0 ? "重生三图" : "生成三图"}
        </button>
      </div>

      {/* Panel grid */}
      <div className="grid grid-cols-3 gap-2">
        {roles.map(({ index, label, role }) => {
          const panel = panels.find((p) => p.panelIndex === index);
          return (
            <div key={index} className="aspect-video rounded-xl border border-gray-700 bg-gray-800/60 overflow-hidden relative group">
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
                  {panel.error?.includes("[生成中]") && (
                    <p className="text-[8px] text-blue-400 text-center leading-tight line-clamp-2">
                      {panel.error.replace("[生成中] ", "")}
                    </p>
                  )}
                </div>
              ) : panel?.status === "failed" ? (
                <div className="h-full flex items-center justify-center p-3">
                  <div className="text-center">
                    <StatusBadge status="failed" />
                    {panel.error && <p className="text-[9px] text-gray-500 mt-1 line-clamp-2">{panel.error}</p>}
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <span className="text-[10px] text-gray-500">{isGeneratingGlob ? "排队中..." : "点击生成"}</span>
                </div>
              )}

              <div className="absolute top-1.5 left-1.5 z-10">
                <span className="text-[10px] bg-black/60 text-gray-300 px-1.5 py-0.5 rounded-md backdrop-blur-sm leading-none">{label}</span>
              </div>

              <div className="absolute inset-x-1 bottom-1 z-20 hidden group-hover:flex gap-1 justify-center">
                <label className="inline-flex items-center gap-1 rounded-md bg-black/70 backdrop-blur-sm text-gray-300 px-2 py-1 text-[10px] cursor-pointer transition-colors hover:bg-black/90 hover:text-white">
                  <Upload className="h-2.5 w-2.5" />
                  {uploadingPanel === index ? "上传中..." : "上传"}
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                    disabled={uploadingPanel !== null}
                    onChange={(e) => handleUpload(index, e.target.files?.[0])} />
                </label>
                {panel?.status === "ready" && (
                  <button onClick={(e) => { e.stopPropagation(); handleClear(index); }} disabled={clearingPanel !== null}
                    className="inline-flex items-center gap-1 rounded-md bg-black/70 backdrop-blur-sm text-rose-300 px-2 py-1 text-[10px] transition-colors hover:bg-black/90 hover:text-rose-200 disabled:opacity-50">
                    <X className="h-2.5 w-2.5" /> {clearingPanel === index ? "取消中..." : "取消"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Review Controls */}
      {currentProject && panels.length > 0 && (
        <div className="flex items-center gap-2 pt-1">
          <span className="text-[10px] text-gray-500">故事板审核：</span>
          {readyCount === 3 ? (
            <button
              onClick={async (e) => {
                e.stopPropagation();
                try {
                  await patch(`/projects/${currentProject!.id}/scenes/${sceneId}/storyboard-review`, { status: "approved" });
                  window.dispatchEvent(new CustomEvent('toast', { detail: { message: '故事板审核已通过', type: 'success' } }));
                } catch (err) {
                  const msg = err instanceof Error ? err.message : "审核失败";
                  window.dispatchEvent(new CustomEvent('toast', { detail: { message: msg, type: 'error' } }));
                }
              }}
              className="inline-flex items-center gap-1 rounded-md bg-emerald-600/80 hover:bg-emerald-600 text-white px-2 py-1 text-[10px] font-medium transition-colors"
            >
              <Check className="h-3 w-3" /> 审核通过
            </button>
          ) : (
            <span className="text-[10px] text-gray-600">
              {panels.some(p => p.status === "generating") ? `图片生成中 (${readyCount}/3 就绪)，完成后可审核...` : `${readyCount}/3 张就绪，需全部完成后才可审核`}
            </span>
          )}
          <button
            onClick={async (e) => {
              e.stopPropagation();
              try {
                await patch(`/projects/${currentProject!.id}/scenes/${sceneId}/storyboard-review`, { status: "rejected", note: "用户驳回" });
                window.dispatchEvent(new CustomEvent('toast', { detail: { message: '故事板已驳回', type: 'info' } }));
              } catch (err) {
                const msg = err instanceof Error ? err.message : "驳回失败";
                window.dispatchEvent(new CustomEvent('toast', { detail: { message: msg, type: 'error' } }));
              }
            }}
            className="inline-flex items-center gap-1 rounded-md bg-rose-600/80 hover:bg-rose-600 text-white px-2 py-1 text-[10px] font-medium transition-colors"
          >
            <XIcon className="h-3 w-3" /> 驳回
          </button>
        </div>
      )}
    </div>
  );
}
