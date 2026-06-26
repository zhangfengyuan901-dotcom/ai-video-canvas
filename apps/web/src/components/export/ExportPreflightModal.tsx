// =========================================================================
// ExportPreflightModal — 导出前体检弹窗
// 逐镜头检查视频状态，选择完整导出或部分导出
// =========================================================================

import { useState, useEffect } from "react";
import { useProjectStore } from "../../stores/projectStore";
import { useVideoClips } from "../../hooks/useVideoClips";

type ExportSceneStatus =
  | "ready"
  | "missing_video"
  | "video_failed"
  | "video_running"
  | "video_queued";

interface ExportSceneCheck {
  sceneId: string;
  order: number;
  title: string;
  status: ExportSceneStatus;
  clipId?: string;
  version?: number;
  duration?: number;
  error?: string;
}

interface ExportPreflightModalProps {
  projectId: string;
  onClose: () => void;
  onConfirm: (allowPartial: boolean) => void;
}

const STATUS_LABEL: Record<ExportSceneStatus, string> = {
  ready: "可导出",
  missing_video: "缺少视频",
  video_failed: "生成失败",
  video_running: "生成中",
  video_queued: "排队中",
};

const STATUS_STYLE: Record<ExportSceneStatus, string> = {
  ready: "bg-green-600/20 text-green-400",
  missing_video: "bg-amber-600/20 text-amber-400",
  video_failed: "bg-red-600/20 text-red-400",
  video_running: "bg-blue-600/20 text-blue-400",
  video_queued: "bg-zinc-700 text-zinc-400",
};

export default function ExportPreflightModal({ projectId, onClose, onConfirm }: ExportPreflightModalProps) {
  const scenes = useProjectStore((s) => s.scenes);
  const { fetchClips, getCurrentClip } = useVideoClips();

  useEffect(() => {
    fetchClips();
  }, [fetchClips]);

  // ---- Compute checks ---------------------------------------------------

  const checks: ExportSceneCheck[] = scenes.map((scene) => {
    const clip = getCurrentClip(scene.id);

    if (!clip) {
      return { sceneId: scene.id, order: scene.order, title: scene.title, status: "missing_video" };
    }
    if (clip.status === "ready") {
      return {
        sceneId: scene.id, order: scene.order, title: scene.title, status: "ready",
        clipId: clip.id, version: clip.version, duration: clip.duration,
      };
    }
    if (clip.status === "failed") {
      return {
        sceneId: scene.id, order: scene.order, title: scene.title, status: "video_failed",
        version: clip.version, error: clip.error,
      };
    }
    if (clip.status === "running") {
      return {
        sceneId: scene.id, order: scene.order, title: scene.title, status: "video_running",
        version: clip.version,
      };
    }
    if (clip.status === "queued") {
      return {
        sceneId: scene.id, order: scene.order, title: scene.title, status: "video_queued",
        version: clip.version,
      };
    }
    return { sceneId: scene.id, order: scene.order, title: scene.title, status: "missing_video" };
  });

  const totalCount = checks.length;
  const readyCount = checks.filter((c) => c.status === "ready").length;
  const missingCount = checks.filter((c) => c.status === "missing_video").length;
  const failedCount = checks.filter((c) => c.status === "video_failed").length;
  const runningCount = checks.filter((c) => c.status === "video_running" || c.status === "video_queued").length;

  const allReady = totalCount > 0 && readyCount === totalCount;
  const hasAnyReady = readyCount > 0;
  const canPartialExport = hasAnyReady && !allReady;

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-[720px] max-h-[80vh] rounded-lg border border-zinc-800 bg-zinc-950 shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-zinc-200">导出前检查</h2>
            <p className="text-[11px] text-zinc-500 mt-0.5">确认每个镜头都有可用视频，导出将使用当前版本。</p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 px-5 py-3 shrink-0">
          <StatCard label="总镜头" value={String(totalCount)} className="text-zinc-400" />
          <StatCard label="可导出" value={String(readyCount)} className="text-green-400" />
          <StatCard label="缺少视频" value={String(missingCount)} className={missingCount > 0 ? "text-amber-400" : "text-zinc-500"} />
          <StatCard label="失败/异常" value={String(failedCount + runningCount)} className={failedCount > 0 ? "text-red-400" : "text-zinc-500"} />
        </div>

        {/* Scene list */}
        <div className="overflow-y-auto px-5 py-2 space-y-1 flex-1">
          {totalCount === 0 ? (
            <p className="text-xs text-zinc-500 py-4 text-center">当前项目还没有镜头，无法导出。</p>
          ) : (
            checks.map((item) => (
              <div
                key={item.sceneId}
                className="flex items-center gap-2 rounded border border-zinc-800 bg-zinc-900/60 px-3 py-2"
              >
                <span className="text-xs text-zinc-500 font-mono shrink-0">#{item.order}</span>
                <span className="text-xs text-zinc-300 truncate flex-1">{item.title}</span>
                <span className="text-[10px] text-zinc-500 shrink-0">
                  {item.version ? `v${item.version}` : ""}
                  {item.duration ? ` · ${item.duration}s` : ""}
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${STATUS_STYLE[item.status]}`}>
                  {STATUS_LABEL[item.status]}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-800 px-5 py-3 flex items-center gap-3 shrink-0">
          {totalCount > 0 && !allReady && (
            <p className="text-[11px] text-zinc-500 flex-1">
              {missingCount > 0 && `还有 ${missingCount} 个镜头没有可用视频。`}
              {failedCount > 0 && `有 ${failedCount} 个镜头视频生成失败。`}
              {runningCount > 0 && `有 ${runningCount} 个镜头仍在生成中。`}
              {canPartialExport && " 你也可以选择部分导出，只导出已完成的视频片段。"}
            </p>
          )}
          {totalCount > 0 && allReady && (
            <p className="text-[11px] text-green-400/80 flex-1">全部镜头都已准备好，将按当前版本导出完整视频。</p>
          )}

          <button
            onClick={onClose}
            className="text-xs px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
          >
            取消
          </button>

          {canPartialExport && (
            <button
              onClick={() => onConfirm(true)}
              className="text-xs px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-white font-medium transition-colors"
            >
              部分导出
            </button>
          )}

          <button
            onClick={() => onConfirm(false)}
            disabled={!allReady}
            title={!allReady ? "请先补齐所有镜头视频" : undefined}
            className="text-xs px-3 py-1.5 rounded font-medium transition-colors bg-green-700 hover:bg-green-600 text-white disabled:bg-zinc-700 disabled:text-zinc-500 disabled:cursor-not-allowed"
          >
            确认导出完整视频
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat card sub-component
// ---------------------------------------------------------------------------

function StatCard({ label, value, className }: { label: string; value: string; className: string }) {
  return (
    <div className="rounded border border-zinc-800 bg-zinc-950/40 p-2.5">
      <div className="text-[10px] text-zinc-500 mb-0.5">{label}</div>
      <div className={`text-sm font-medium ${className}`}>{value}</div>
    </div>
  );
}
