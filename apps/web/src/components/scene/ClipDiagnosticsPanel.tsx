// =========================================================================
// ClipDiagnosticsPanel — RunningHub 诊断信息展示组件
// 展示当前 clip 的 RunningHub 诊断摘要，可展开查看详情。
// 展开时调用 detail endpoint 加载完整 diagnostics。
// 设计为低干扰、暗色、简洁。
// =========================================================================

import { useEffect, useState } from "react";
import { useApi } from "../../hooks/useApi";
import type {
  RunningHubClipDiagnostics,
  VideoClip,
  VideoClipDiagnosticsDetail,
} from "@ai-video-canvas/shared";

interface ClipDiagnosticsPanelProps {
  clip: VideoClip;
}

interface ResultItem {
  nodeId?: string;
  outputType?: string;
  url?: string;
  text?: string | null;
}

export default function ClipDiagnosticsPanel({ clip }: ClipDiagnosticsPanelProps) {
  const { get } = useApi();
  const [open, setOpen] = useState(false);
  const [fullDiagnostics, setFullDiagnostics] = useState<RunningHubClipDiagnostics | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailLoaded, setDetailLoaded] = useState(false);

  const summaryDiagnostics = clip.diagnostics;
  const d = fullDiagnostics ?? summaryDiagnostics;

  // Reset state when clip changes
  useEffect(() => {
    setOpen(false);
    setFullDiagnostics(null);
    setLoadingDetail(false);
    setDetailError(null);
    setDetailLoaded(false);
  }, [clip.id]);

  // Load full diagnostics from detail endpoint
  async function loadFullDiagnostics() {
    if (detailLoaded || loadingDetail) return;

    setLoadingDetail(true);
    setDetailError(null);

    try {
      const detail = await get<VideoClipDiagnosticsDetail>(
        `/projects/${clip.projectId}/scenes/${clip.sceneId}/videos/${clip.id}/diagnostics`,
      );

      setFullDiagnostics(detail.diagnostics);
      setDetailLoaded(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "诊断详情加载失败";
      setDetailError(msg);
    } finally {
      setLoadingDetail(false);
    }
  }

  if (!d) return null;

  const rhStatus = d.status ?? "unknown";
  const hasError = clip.status === "failed" || !!d.errorCode || !!d.errorMessage;

  return (
    <div className="mt-2 rounded border border-zinc-800 bg-zinc-900/60 p-2">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          const nextOpen = !open;
          setOpen(nextOpen);
          if (nextOpen) {
            void loadFullDiagnostics();
          }
        }}
        className="w-full flex items-center gap-2 text-left"
      >
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${statusClass(rhStatus, hasError)}`}>
          RH {rhStatus}
        </span>

        {d.outputType && (
          <span className="text-[10px] text-zinc-500">
            type: {d.outputType}
          </span>
        )}

        {d.outputNodeId && (
          <span className="text-[10px] text-zinc-500">
            node: {d.outputNodeId}
          </span>
        )}

        {d.taskCostTime && (
          <span className="text-[10px] text-zinc-500">
            cost: {d.taskCostTime}s
          </span>
        )}

        <span className="ml-auto text-[10px] text-zinc-600">
          {open ? "收起诊断" : "查看诊断"}
        </span>
      </button>

      {open && (
        <div className="mt-2 space-y-1 border-t border-zinc-800 pt-2 text-[10px] text-zinc-500">
          {loadingDetail && (
            <div className="text-[10px] text-zinc-600">正在加载完整诊断...</div>
          )}

          {detailError && (
            <div className="text-[10px] text-yellow-500">
              完整诊断加载失败，当前显示摘要：{detailError}
            </div>
          )}

          <DiagRow label="taskId" value={clip.taskId} mono />
          <DiagRow label="lastPolledAt" value={formatTime(d.lastPolledAt)} />
          <DiagRow label="completedAt" value={formatTime(d.completedAt)} />
          <DiagRow label="errorCode" value={d.errorCode} mono />
          <DiagRow label="errorMessage" value={d.errorMessage ?? clip.error} />
          <DiagRow label="promptTips" value={summarize(d.promptTips, 240)} />
          <DiagRow label="failedReason" value={summarizeUnknown(d.failedReason, 240)} />
          <DiagRow label="usage" value={summarizeUnknown(d.usage, 240)} mono />
          <ResultsSummary results={d.results} />
        </div>
      )}
    </div>
  );
}

function ResultsSummary({
  results,
}: {
  results?: ResultItem[] | null;
}) {
  if (!Array.isArray(results) || results.length === 0) return null;

  return (
    <div className="grid grid-cols-[90px_1fr] gap-2">
      <span className="text-zinc-600">results</span>
      <div className="space-y-1">
        {results.map((r, i) => (
          <div key={`${r.nodeId ?? "node"}-${i}`} className="font-mono text-zinc-400 break-all">
            #{i + 1} node={r.nodeId ?? "?"} type={r.outputType ?? "?"}
            {r.url ? ` url=...${r.url.slice(-32)}` : ""}
            {r.text ? ` text=${summarize(r.text, 80)}` : ""}
          </div>
        ))}
      </div>
    </div>
  );
}

function DiagRow({
  label,
  value,
  mono,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
}) {
  if (!value) return null;

  return (
    <div className="grid grid-cols-[90px_1fr] gap-2">
      <span className="text-zinc-600">{label}</span>
      <span className={mono ? "font-mono text-zinc-400 break-all" : "text-zinc-400 break-words"}>
        {value}
      </span>
    </div>
  );
}

function statusClass(status: string, hasError: boolean): string {
  if (hasError || status === "FAILED") return "bg-red-600/20 text-red-400";
  if (status === "SUCCESS") return "bg-green-600/20 text-green-400";
  if (status === "RUNNING" || status === "QUEUED" || status === "SUBMITTED") {
    return "bg-blue-600/20 text-blue-400";
  }
  return "bg-zinc-800 text-zinc-500";
}

function formatTime(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function summarize(value?: string | null, max = 240): string | null {
  if (!value) return null;
  return value.length > max ? value.slice(0, max) + "..." : value;
}

function summarizeUnknown(value: unknown, max = 240): string | null {
  if (value === undefined || value === null) return null;

  try {
    const text = typeof value === "string" ? value : JSON.stringify(value);
    return summarize(text, max);
  } catch {
    return "[unserializable]";
  }
}
