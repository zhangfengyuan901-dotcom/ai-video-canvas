// =========================================================================
// ClipDiagnosticsDrawer -- Right-side diagnostics drawer
// Full RunningHub diagnostics display, including retry guidance, copy buttons,
// usage, results, failedReason, promptTips, etc.
// =========================================================================

import { useEffect } from "react";
import type { VideoClip } from "@ai-video-canvas/shared";
import { useClipDiagnosticsDetail } from "../../hooks/useClipDiagnosticsDetail";
import DiagnosticsCopyButton from "./DiagnosticsCopyButton";
import {
  buildRunningHubRetryGuidance,
  buildDiagnosticsCopyText,
  buildErrorSummary,
  prettyJson,
  redactUrl,
  formatPromptTips,
  formatFailedReason,
  truncateMiddle,
} from "../../utils/runninghubDiagnostics";

interface ClipDiagnosticsDrawerProps {
  clip: VideoClip | null;
  open: boolean;
  onClose: () => void;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
}

export default function ClipDiagnosticsDrawer({
  clip,
  open,
  onClose,
  onRegenerate,
  isRegenerating,
}: ClipDiagnosticsDrawerProps) {
  var { diagnostics, loading, error: detailError, loaded, load, reload } = useClipDiagnosticsDetail(clip);

  useEffect(function () {
    if (open && clip) { void load(); }
  }, [open, clip?.id, load]);

  if (!open || !clip) return null;

  var d = diagnostics;
  var guidance = buildRunningHubRetryGuidance(clip, d);
  var fullJson = buildDiagnosticsCopyText(clip, d);
  var errorSummary = buildErrorSummary(clip, d);
  var failedReasonFormatted = formatFailedReason(d?.failedReason);
  var promptTipsFormatted = formatPromptTips(d?.promptTips);

  function severityBorder(severity: string): string {
    if (severity === "error") return "border-red-800 bg-red-950/30";
    if (severity === "warning") return "border-yellow-800 bg-yellow-950/30";
    return "border-blue-800 bg-blue-950/30";
  }
  function severityBadge(severity: string): string {
    if (severity === "error") return "bg-red-600/20 text-red-400";
    if (severity === "warning") return "bg-yellow-600/20 text-yellow-400";
    return "bg-blue-600/20 text-blue-400";
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        onClick={function (e) { e.stopPropagation(); onClose(); }}
        aria-label="Closediagnostics drawer overlay"
      />
      <aside
        className="relative z-10 h-full w-[420px] max-w-[92vw] overflow-y-auto border-l border-gray-700 bg-gray-900 shadow-2xl"
        onClick={function (e) { e.stopPropagation(); }}
      >
        {/* Header */}
        <div className="sticky top-0 z-20 border-b border-gray-700 bg-gray-900 p-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium text-gray-200">RunningHub Diagnostics</h2>
              <p className="text-[10px] text-gray-500 mt-0.5">
                Clip v{clip.version} | {clip.status}
              </p>
            </div>
            <button
              type="button"
              onClick={function (e) { e.stopPropagation(); onClose(); }}
              className="text-[11px] text-gray-500 hover:text-gray-300 px-2 py-1 rounded border border-gray-600 hover:border-gray-500"
            >
              Close
            </button>
          </div>
          <button
            type="button"
            onClick={function (e) { e.stopPropagation(); void reload(); }}
            disabled={loading}
            className="mt-2 text-[10px] text-blue-400 hover:text-blue-300 disabled:text-gray-500"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className="p-3 space-y-3">
          {/* Retry Guidance */}
          <div className={"rounded border p-2 " + severityBorder(guidance.severity)}>
            <div className="flex items-center gap-2 mb-1">
              <span className={"text-[10px] px-1.5 py-0.5 rounded " + severityBadge(guidance.severity)}>
                {guidance.code}
              </span>
              <span className="text-[11px] font-medium text-gray-300">{guidance.title}</span>
            </div>
            <p className="text-[10px] text-gray-400">{guidance.message}</p>
            {guidance.actions.length > 0 && (
              <ul className="mt-1 list-disc list-inside text-[10px] text-gray-500 space-y-0.5">
                {guidance.actions.map(function (a, i) { return <li key={i}>{a}</li>; })}
              </ul>
            )}
            {guidance.canRetry && onRegenerate && (
              <button
                type="button"
                onClick={function (e) { e.stopPropagation(); onRegenerate(); }}
                disabled={isRegenerating}
                className="mt-2 text-[10px] bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded disabled:bg-gray-600 disabled:text-gray-500"
              >
                {isRegenerating ? "Submitting retry..." : "Create retry"}
              </button>
            )}
          </div>

          {/* Loading / Error */}
          {loading && <div className="text-[10px] text-gray-500">Loading full diagnostics...</div>}
          {detailError && <div className="text-[10px] text-yellow-500">Diagnostics load failed: {detailError} (showing summary)</div>}
          {!loaded && !loading && !detailError && <div className="text-[10px] text-gray-500">Click "Load details" for full diagnostics</div>}

          {/* Summary Cards */}
          <Section title="Overview">
            <DiagRow label="RH Status" value={d?.status ?? clip.status} />
            <DiagRow label="Clip Status" value={clip.status} />
            <DiagRow label="Output Node" value={d?.outputNodeId} />
            <DiagRow label="Output Type" value={d?.outputType} />
            <DiagRow label="Task Cost Time" value={d?.taskCostTime ? d.taskCostTime + "s" : null} />
            <DiagRow label="Last Polled" value={formatTime(d?.lastPolledAt)} />
            <DiagRow label="Completed" value={formatTime(d?.completedAt)} />
            <DiagRow label="taskId" value={clip.taskId} mono />
          </Section>

          {/* Copy Buttons */}
          <Section title="Copy">
            <div className="flex flex-wrap gap-1.5">
              <DiagnosticsCopyButton label="Copy taskId" value={clip.taskId} />
              <DiagnosticsCopyButton label="Copyerror summary" value={errorSummary} />
              <DiagnosticsCopyButton label="Copy failedReason" value={failedReasonFormatted.pretty} />
              <DiagnosticsCopyButton label="Copy promptTips" value={promptTipsFormatted.pretty} />
              <DiagnosticsCopyButton label="Copyfull diagnostics" value={fullJson} />
            </div>
          </Section>

          {/* Retry Lineage */}
          {(clip.retryOfClipId || clip.retrySource || (clip.retryChildren && clip.retryChildren.length > 0)) && (
            <Section title="Retry Lineage">
              {clip.retrySource && (
                <DiagRow
                  label="Retry Of"
                  value={"v" + clip.retrySource.version + " | " + clip.retrySource.status + " | " + clip.retrySource.id}
                  mono
                />
              )}

              {clip.retryReason && (
                <DiagRow label="Retry Reason" value={clip.retryReason} />
              )}

              {clip.retryCreatedAt && (
                <DiagRow label="Retry Created" value={formatTime(clip.retryCreatedAt)} />
              )}

              {clip.retryChildren && clip.retryChildren.length > 0 && (
                <div className="grid grid-cols-[120px_1fr] gap-2 text-[10px]">
                  <span className="text-gray-500">Retry Children</span>
                  <div className="space-y-1">
                    {clip.retryChildren.map(function (child) {
                      return (
                        <div key={child.id} className="font-mono text-gray-400 break-all">
                          v{child.version} | {child.status} | {child.id}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </Section>
          )}

          {/* Usage */}
          {d?.usage && (
            <Section title="Usage">
              <DiagRow label="consumeMoney" value={prettyJson((d.usage as any).consumeMoney)} mono />
              <DiagRow label="consumeCoins" value={prettyJson((d.usage as any).consumeCoins)} mono />
              <DiagRow label="thirdPartyConsumeMoney" value={prettyJson((d.usage as any).thirdPartyConsumeMoney)} mono />
              <DiagRow label="taskCostTime" value={d.taskCostTime ? d.taskCostTime + "s" : null} />
            </Section>
          )}

          {/* Results */}
          {Array.isArray(d?.results) && d!.results!.length > 0 && (
            <Section title={"Results (" + d!.results!.length + ")"}>
              {(d!.results!).map(function (r, i) {
                return (
                  <div key={i} className="rounded bg-gray-800/60 p-1.5 text-[10px] space-y-0.5">
                    <DiagRow label={"#" + (i + 1) + " nodeId"} value={r.nodeId} mono />
                    <DiagRow label={"outputType"} value={r.outputType} />
                    <DiagRow label={"url"} value={redactUrl(r.url)} mono />
                    <DiagRow label={"text"} value={truncateMiddle(r.text ?? "", 120) || null} />
                  </div>
                );
              })}
            </Section>
          )}

          {/* failedReason */}
          {failedReasonFormatted.pretty && (
            <Section title="failedReason">
              <p className="text-[10px] text-gray-500 mb-1">{failedReasonFormatted.summary}</p>
              <pre className="max-h-64 overflow-auto rounded bg-gray-800 p-2 font-mono text-[10px] text-gray-400 break-all whitespace-pre-wrap">
                {failedReasonFormatted.pretty}
              </pre>
            </Section>
          )}

          {/* promptTips */}
          {promptTipsFormatted.pretty && (
            <Section title="promptTips">
              <pre className="max-h-64 overflow-auto rounded bg-gray-800 p-2 font-mono text-[10px] text-gray-400 break-all whitespace-pre-wrap">
                {promptTipsFormatted.pretty}
              </pre>
            </Section>
          )}

          {/* Bottom spacing */}
          <div className="h-4" />
        </div>
      </aside>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[11px] font-medium text-gray-400 mb-1">{title}</h3>
      {children}
    </div>
  );
}

function DiagRow({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2 text-[10px]">
      <span className="text-gray-500">{label}</span>
      <span className={mono ? "font-mono text-gray-400 break-all" : "text-gray-400 break-words"}>{value}</span>
    </div>
  );
}

function formatTime(value?: string | null): string | null {
  if (!value) return null;
  var date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}
