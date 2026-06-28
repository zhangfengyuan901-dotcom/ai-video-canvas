// =========================================================================
// ClipDiagnosticsPanel — RunningHub 诊断信息展示组件（轻量摘要）
// 展示当前 clip 的 RunningHub 诊断摘要，可展开查看详情。
// 展开时通过 useClipDiagnosticsDetail hook 加载完整 diagnostics。
// 提供 onOpenDrawer prop 用于跳转到完整排障抽屉。
// =========================================================================

import { useState } from "react";
import { useClipDiagnosticsDetail } from "../../hooks/useClipDiagnosticsDetail";
import type { VideoClip } from "@ai-video-canvas/shared";

interface ResultItem {
  nodeId?: string;
  outputType?: string;
  url?: string;
  text?: string | null;
}

interface ClipDiagnosticsPanelProps {
  clip: VideoClip;
  onOpenDrawer?: () => void;
}

export default function ClipDiagnosticsPanel({ clip, onOpenDrawer }: ClipDiagnosticsPanelProps) {
  var [open, setOpen] = useState(false);
  var { diagnostics: d, loading, error: detailError, load } = useClipDiagnosticsDetail(clip);

  if (!d) return null;

  var rhStatus = d.status ?? "unknown";
  var hasError = clip.status === "failed" || !!d.errorCode || !!d.errorMessage;

  return (
    <div className="mt-2 rounded border border-gray-700 bg-gray-800/60 p-2">
      <button
        type="button"
        onClick={function (e) {
          e.stopPropagation();
          var nextOpen = !open;
          setOpen(nextOpen);
          if (nextOpen) void load();
        }}
        className="w-full flex items-center gap-2 text-left"
      >
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${statusClass(rhStatus, hasError)}`}>
          RH {rhStatus}
        </span>
        {d.outputType && <span className="text-[10px] text-gray-500">type: {d.outputType}</span>}
        {d.outputNodeId && <span className="text-[10px] text-gray-500">node: {d.outputNodeId}</span>}
        {d.taskCostTime && <span className="text-[10px] text-gray-500">cost: {d.taskCostTime}s</span>}
        <span className="ml-auto text-[10px] text-gray-600">{open ? "收起诊断" : "查看诊断"}</span>
      </button>

      {open && (
        <div className="mt-2 space-y-1 border-t border-gray-700 pt-2 text-[10px] text-gray-500">
          {onOpenDrawer && (
            <div className="pb-1">
              <button
                type="button"
                onClick={function (e) { e.stopPropagation(); onOpenDrawer(); }}
                className="text-[10px] text-blue-400 hover:text-blue-300"
              >
                打开完整排障详情
              </button>
            </div>
          )}

          {loading && <div className="text-[10px] text-gray-600">正在加载完整诊断...</div>}
          {detailError && <div className="text-[10px] text-yellow-500">完整诊断加载失败，当前显示摘要：{detailError}</div>}

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

function ResultsSummary({ results }: { results?: ResultItem[] | null }) {
  if (!Array.isArray(results) || results.length === 0) return null;

  return (
    <div className="grid grid-cols-[90px_1fr] gap-2">
      <span className="text-gray-600">results</span>
      <div className="space-y-1">
        {results.map(function (r, i) {
          return (
            <div key={`${r.nodeId ?? "node"}-${i}`} className="font-mono text-gray-400 break-all">
              #{i + 1} node={r.nodeId ?? "?"} type={r.outputType ?? "?"}
              {r.url ? " url=..." + r.url.slice(-32) : ""}
              {r.text ? " text=" + summarize(r.text, 80) : ""}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DiagRow({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-[90px_1fr] gap-2">
      <span className="text-gray-600">{label}</span>
      <span className={mono ? "font-mono text-gray-400 break-all" : "text-gray-400 break-words"}>{value}</span>
    </div>
  );
}

function statusClass(status: string, hasError: boolean): string {
  if (hasError || status === "FAILED") return "bg-red-600/20 text-red-400";
  if (status === "SUCCESS") return "bg-green-600/20 text-green-400";
  if (status === "RUNNING" || status === "QUEUED" || status === "SUBMITTED") return "bg-blue-600/20 text-blue-400";
  return "bg-gray-700 text-gray-500";
}

function formatTime(value?: string | null): string | null {
  if (!value) return null;
  var date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function summarize(value?: string | null, max?: number): string | null {
  if (!max) max = 240;
  if (!value) return null;
  return value.length > max ? value.slice(0, max) + "..." : value;
}

function summarizeUnknown(value: unknown, max?: number): string | null {
  if (!max) max = 240;
  if (value === undefined || value === null) return null;
  try {
    var text = typeof value === "string" ? value : JSON.stringify(value);
    return summarize(text, max);
  } catch { return "[unserializable]"; }
}
