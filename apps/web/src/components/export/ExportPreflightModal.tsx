// =========================================================================
// ExportPreflightModal — 导出前体检弹窗 (redesigned)
// 逐镜头检查视频状态，选择完整导出或部分导出
// =========================================================================

import { useState, useEffect } from "react";
import { useApi } from "../../hooks/useApi";
import { AlertCircle, AlertTriangle, CheckCircle2, X, Download, Film } from "lucide-react";

interface ExportPreflightSceneItem {
  sceneId: string;
  order: number;
  title: string;
  clipId: string;
  version: number;
  localPath: string;
  duration: number;
  approved: boolean;
  isCurrent: boolean;
}

interface ExportPreflightResult {
  canExport: boolean;
  canPartialExport: boolean;
  totalScenes: number;
  readyScenes: number;
  approvedVideoScenes: number;
  estimatedDuration: number;
  missingScenes: Array<{
    sceneId: string;
    order: number;
    title: string;
    reason: string;
  }>;
  unapprovedVideoScenes: Array<{
    sceneId: string;
    order: number;
    title: string;
    clipId?: string;
    version?: number;
  }>;
  usingFallbackClips: Array<{
    sceneId: string;
    order: number;
    title: string;
    clipId: string;
    version: number;
    reason: string;
  }>;
  exportItems: ExportPreflightSceneItem[];
}

interface ExportPreflightModalProps {
  projectId: string;
  onClose: () => void;
  onConfirm: (allowPartial: boolean) => void;
}

export default function ExportPreflightModal({ projectId, onClose, onConfirm }: ExportPreflightModalProps) {
  const { get } = useApi();
  const [preflight, setPreflight] = useState<ExportPreflightResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await get<ExportPreflightResult>(`/projects/${projectId}/export/preflight`);
        setPreflight(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "加载预检信息失败");
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId, get]);

  const totalCount = preflight?.totalScenes ?? 0;
  const readyCount = preflight?.readyScenes ?? 0;
  const approvedCount = preflight?.approvedVideoScenes ?? 0;
  const missingCount = preflight?.missingScenes.length ?? 0;
  const unapprovedCount = preflight?.unapprovedVideoScenes.length ?? 0;
  const fallbackCount = preflight?.usingFallbackClips.length ?? 0;
  const canExport = preflight?.canExport ?? false;
  const canPartialExport = preflight?.canPartialExport ?? false;
  const estDuration = preflight?.estimatedDuration ?? 0;

  const modalContent = (children: React.ReactNode) => (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="w-[740px] max-h-[85vh] rounded-2xl border border-gray-600 bg-gray-900 shadow-2xl shadow-black/50 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );

  if (loading) {
    return modalContent(
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="relative h-8 w-8">
          <div className="absolute inset-0 rounded-full border-2 border-gray-700" />
          <div className="absolute inset-0 rounded-full border-2 border-t-blue-500 animate-spin" />
        </div>
        <p className="text-sm text-gray-400">正在加载预检信息...</p>
      </div>
    );
  }

  if (error) {
    return modalContent(
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-600/10">
          <AlertCircle className="h-6 w-6 text-rose-400" />
        </div>
        <p className="text-sm text-rose-400">{error}</p>
        <button onClick={onClose}
          className="rounded-xl border border-gray-600 bg-gray-700 px-4 py-2 text-xs font-medium text-gray-300 transition-all hover:bg-gray-600">
          关闭
        </button>
      </div>
    );
  }

  const hasMissing = preflight!.missingScenes.length > 0;
  const hasUnapproved = preflight!.unapprovedVideoScenes.length > 0;
  const hasFallback = preflight!.usingFallbackClips.length > 0;

  function formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}分${s}秒` : `${s}秒`;
  }

  return modalContent(
    <>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-700 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 shadow-sm">
              <Download className="h-4.5 w-4.5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-100">导出前检查</h2>
              <p className="text-[11px] text-gray-500 mt-0.5">确认每个镜头都有可用视频，导出将使用当前版本</p>
            </div>
          </div>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-700 transition-all">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-5 gap-2 mt-4">
          <MiniStat label="总镜头" value={String(totalCount)} />
          <MiniStat label="可导出" value={String(readyCount)} accent />
          <MiniStat label="已审核" value={String(approvedCount)} />
          <MiniStat label="预定时长" value={formatDuration(estDuration)} />
          <MiniStat label="缺失/未审" value={String(missingCount + unapprovedCount)} warn={(missingCount + unapprovedCount) > 0} />
        </div>

        {/* Status summary */}
        {canExport ? (
          <div className="flex items-center gap-2 mt-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <span className="text-xs text-emerald-400">全部镜头视频已就绪，可以导出完整视频</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 mt-3 rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-2">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
            <span className="text-xs text-amber-400">
              {missingCount > 0 && `还有 ${missingCount} 个镜头没有可用视频。`}
              {unapprovedCount > 0 && `有 ${unapprovedCount} 个镜头视频未审核。`}
            </span>
          </div>
        )}
      </div>

      {/* Scene details */}
      <div className="overflow-y-auto px-6 py-4 space-y-3 flex-1">
        {/* Missing scenes */}
        {hasMissing && (
          <Section title="缺少视频（不能导出）" icon={<AlertCircle className="h-3 w-3 text-rose-400" />}>
            {preflight!.missingScenes.map(function(item) {
              return (
                <div key={item.sceneId} className="flex items-center gap-3 rounded-xl border border-rose-500/15 bg-rose-500/[0.04] px-4 py-2.5">
                  <span className="text-xs text-gray-500 font-mono w-8 shrink-0">#{item.order}</span>
                  <span className="text-xs text-gray-300 truncate flex-1">{item.title}</span>
                  <span className="text-[10px] text-rose-400 shrink-0">{item.reason}</span>
                </div>
              );
            })}
          </Section>
        )}

        {/* Unapproved scenes */}
        {hasUnapproved && (
          <Section title="未审核视频（仍可用）" icon={<AlertTriangle className="h-3 w-3 text-amber-400" />}>
            {preflight!.unapprovedVideoScenes.map(function(item) {
              return (
                <div key={item.sceneId} className="flex items-center gap-3 rounded-xl border border-amber-500/15 bg-amber-500/[0.04] px-4 py-2.5">
                  <span className="text-xs text-gray-500 font-mono w-8 shrink-0">#{item.order}</span>
                  <span className="text-xs text-gray-300 truncate flex-1">{item.title}</span>
                  {item.version && <span className="text-[10px] text-gray-500">v{item.version}</span>}
                  <span className="text-[10px] text-amber-400">未审核</span>
                </div>
              );
            })}
          </Section>
        )}

        {/* Using fallback clips */}
        {hasFallback && (
          <Section title="使用备用版本" icon={<AlertTriangle className="h-3 w-3 text-blue-400" />}>
            {preflight!.usingFallbackClips.map(function(item) {
              return (
                <div key={item.sceneId + "-fb"} className="flex items-center gap-3 rounded-xl border border-blue-500/15 bg-blue-500/[0.04] px-4 py-2.5">
                  <span className="text-xs text-gray-500 font-mono w-8 shrink-0">#{item.order}</span>
                  <span className="text-xs text-gray-300 truncate flex-1">{item.title}</span>
                  <span className="text-[10px] text-gray-500">v{item.version}</span>
                  <span className="text-[10px] text-blue-300 truncate max-w-[200px]">{item.reason}</span>
                </div>
              );
            })}
          </Section>
        )}

        {/* Normal export items */}
        {preflight!.exportItems.length > 0 && (
          <Section title={`可导出镜头 (${preflight!.exportItems.length})`} icon={<Film className="h-3 w-3 text-emerald-400" />}>
            {preflight!.exportItems.map(function(item) {
              return (
                <div key={item.sceneId + "-exp"} className="flex items-center gap-3 rounded-xl border border-gray-700 bg-gray-800 px-4 py-2.5 hover:bg-gray-800/80 transition-colors">
                  <span className="text-xs text-gray-500 font-mono w-8 shrink-0">#{item.order}</span>
                  <span className="text-xs text-gray-300 truncate flex-1">{item.title}</span>
                  <span className="text-[10px] text-gray-500 shrink-0 flex items-center gap-1.5">
                    <span className="rounded-md border border-gray-700 px-1.5 py-0.5">v{item.version}</span>
                    <span>{item.duration}s</span>
                    {item.approved ? (
                      <span className="text-emerald-400">已审</span>
                    ) : (
                      <span className="text-amber-400">未审</span>
                    )}
                    {item.isCurrent ? (
                      <span className="text-blue-400">当前</span>
                    ) : (
                      <span className="text-gray-500">非当前</span>
                    )}
                  </span>
                </div>
              );
            })}
          </Section>
        )}

        {preflight!.exportItems.length === 0 && totalCount > 0 && (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <Film className="h-8 w-8 text-gray-500" />
            <p className="text-xs text-gray-500">没有可导出的视频片段</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-700 px-6 py-4 flex items-center gap-3 shrink-0">
        <div className="flex-1">
          {canExport && (
            <p className="text-[11px] text-emerald-400/80">全部镜头视频已审核通过，将按当前版本导出完整视频。</p>
          )}
          {!canExport && (
            <div className="space-y-0.5">
              {canPartialExport && (
                <p className="text-[11px] text-amber-400 font-medium">⚠ 部分镜头不可用，导出视频将不完整</p>
              )}
              <p className="text-[11px] text-gray-500">
                {missingCount > 0 && `还有 ${missingCount} 个镜头没有可用视频。`}
                {unapprovedCount > 0 && `有 ${unapprovedCount} 个镜头视频未审核。`}
                {canPartialExport && "你也可以选择部分导出，只导出已完成的视频片段。"}
              </p>
            </div>
          )}
        </div>

        <button onClick={onClose} className="rounded-xl border border-gray-600 bg-gray-700 px-4 py-2 text-xs font-medium text-gray-300 transition-all hover:bg-gray-600">
          取消
        </button>

        {canPartialExport && (
          <button onClick={() => onConfirm(true)}
            className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-medium text-white transition-all hover:bg-amber-500 active:bg-amber-700">
            部分导出
          </button>
        )}

        <button
          onClick={() => onConfirm(false)}
          disabled={!canExport}
          className="rounded-xl bg-gradient-to-b from-blue-500 to-blue-600 text-white px-5 py-2 text-xs font-medium transition-all hover:from-blue-400 hover:to-blue-500 active:from-blue-600 active:to-blue-700 disabled:opacity-40 disabled:pointer-events-none shadow-sm shadow-blue-500/20"
        >
          确认导出完整视频
        </button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------

function MiniStat({ label, value, accent, warn }: { label: string; value: string; accent?: boolean; warn?: boolean }) {
  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800 p-2.5">
      <div className="text-[10px] text-gray-500 mb-0.5">{label}</div>
      <div className={`text-sm font-semibold tracking-tight ${warn ? "text-amber-400" : accent ? "text-emerald-400" : "text-gray-100"}`}>
        {value}
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        {icon}
        <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500">{title}</p>
      </div>
      <div className="space-y-1.5">
        {children}
      </div>
    </div>
  );
}
