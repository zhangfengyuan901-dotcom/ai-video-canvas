// =========================================================================
// ClipDiagnosticsPanel — RunningHub 诊断信息展示组件
// 展示当前 clip 的 RunningHub 诊断摘要，可展开查看详情。
// 设计为低干扰、暗色、简洁。
// =========================================================================

import { useState } from "react";
import type { VideoClip } from "@ai-video-canvas/shared";

interface ClipDiagnosticsPanelProps {
  clip: VideoClip;
}

export default function ClipDiagnosticsPanel({ clip }: ClipDiagnosticsPanelProps) {
  const [open, setOpen] = useState(false);
  const d = clip.diagnostics;

  if (!d) return null;

  const rhStatus = d.status ?? "unknown";
  const hasError = clip.status === "failed" || !!d.errorCode || !!d.errorMessage;

  return (
    <div className="mt-2 rounded border border-zinc-800 bg-zinc-900/60 p-2">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
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
          <DiagRow label="taskId" value={clip.taskId} mono />
          <DiagRow label="lastPolledAt" value={formatTime(d.lastPolledAt)} />
          <DiagRow label="completedAt" value={formatTime(d.completedAt)} />
          <DiagRow label="errorCode" value={d.errorCode} mono />
          <DiagRow label="errorMessage" value={d.errorMessage ?? clip.error} />
          <DiagRow label="promptTips" value={summarize(d.promptTips, 240)} />
          <DiagRow label="failedReason" value={summarizeUnknown(d.failedReason, 240)} />
          <DiagRow label="usage" value={summarizeUnknown(d.usage, 240)} mono />
          <DiagRow
            label="results"
            value={Array.isArray(d.results) ? d.results.length + " item(s)" : undefined}
          />
        </div>
      )}
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
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return summarize(text, max);
}
