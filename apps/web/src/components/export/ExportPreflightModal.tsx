// =========================================================================
// ExportPreflightModal — 导出前体检弹窗
// 逐镜头检查视频状态，选择完整导出或部分导出
// =========================================================================

import { useState, useEffect } from "react";
import { useApi } from "../../hooks/useApi";

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

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="w-[720px] rounded-lg border border-zinc-800 bg-zinc-950 shadow-xl p-8 text-center">
          <p className="text-sm text-zinc-400 animate-pulse">正在加载预检信息...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="w-[720px] rounded-lg border border-zinc-800 bg-zinc-950 shadow-xl p-8 text-center">
          <p className="text-sm text-red-400 mb-4">{error}</p>
          <button onClick={onClose} className="text-xs px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors">关闭</button>
        </div>
      </div>
    );
  }

  const hasMissing = preflight!.missingScenes.length > 0;
  const hasUnapproved = preflight!.unapprovedVideoScenes.length > 0;
  const hasFallback = preflight!.usingFallbackClips.length > 0;

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
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-lg leading-none">x</button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 px-5 py-3 shrink-0">
          <StatCard label="总镜头" value={String(totalCount)} className="text-zinc-400" />
          <StatCard label="可导出" value={String(readyCount)} className="text-green-400" />
          <StatCard label="已审核" value={String(approvedCount)} className="text-blue-400" />
          <StatCard label="缺少/未审" value={String(missingCount + unapprovedCount)} className={(missingCount + unapprovedCount) > 0 ? "text-amber-400" : "text-zinc-500"} />
        </div>

        {/* Scene details */}
        <div className="overflow-y-auto px-5 py-2 space-y-2 flex-1">
          {/* Missing scenes */}
          {hasMissing && (
            <div>
              <p className="text-[10px] text-red-400 font-medium mb-1">缺少视频（不能导出）</p>
              <div className="space-y-1">
                {preflight!.missingScenes.map(function(item) {
                  return (
                    <div key={item.sceneId} className="flex items-center gap-2 rounded border border-red-800/40 bg-red-900/20 px-3 py-1.5">
                      <span className="text-xs text-zinc-500 font-mono shrink-0">#{item.order}</span>
                      <span className="text-xs text-zinc-300 truncate flex-1">{item.title}</span>
                      <span className="text-[10px] text-red-400 shrink-0">{item.reason}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Unapproved scenes */}
          {hasUnapproved && (
            <div>
              <p className="text-[10px] text-amber-400 font-medium mb-1">未审核视频（仍可用）</p>
              <div className="space-y-1">
                {preflight!.unapprovedVideoScenes.map(function(item) {
                  return (
                    <div key={item.sceneId} className="flex items-center gap-2 rounded border border-amber-800/40 bg-amber-900/20 px-3 py-1.5">
                      <span className="text-xs text-zinc-500 font-mono shrink-0">#{item.order}</span>
                      <span className="text-xs text-zinc-300 truncate flex-1">{item.title}</span>
                      {item.version && <span className="text-[10px] text-zinc-500">v{item.version}</span>}
                      <span className="text-[10px] text-amber-400">未审核</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Using fallback clips */}
          {hasFallback && (
            <div>
              <p className="text-[10px] text-blue-400 font-medium mb-1">使用备用版本</p>
              <div className="space-y-1">
                {preflight!.usingFallbackClips.map(function(item) {
                  return (
                    <div key={item.sceneId + "-fb"} className="flex items-center gap-2 rounded border border-blue-800/40 bg-blue-900/20 px-3 py-1.5">
                      <span className="text-xs text-zinc-500 font-mono shrink-0">#{item.order}</span>
                      <span className="text-xs text-zinc-300 truncate flex-1">{item.title}</span>
                      <span className="text-[10px] text-zinc-500">v{item.version}</span>
                      <span className="text-[10px] text-blue-300 truncate max-w-[200px]">{item.reason}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Normal export items */}
          {preflight!.exportItems.length > 0 && (
            <div>
              <p className="text-[10px] text-green-400 font-medium mb-1">可导出镜头 ({preflight!.exportItems.length})</p>
              <div className="space-y-1">
                {preflight!.exportItems.map(function(item) {
                  return (
                    <div key={item.sceneId + "-exp"} className="flex items-center gap-2 rounded border border-zinc-800 bg-zinc-900/60 px-3 py-2">
                      <span className="text-xs text-zinc-500 font-mono shrink-0">#{item.order}</span>
                      <span className="text-xs text-zinc-300 truncate flex-1">{item.title}</span>
                      <span className="text-[10px] text-zinc-500 shrink-0">
                        v{item.version} &middot; {item.duration}s
                        {item.approved ? <span className="text-green-400 ml-1">已审</span> : <span className="text-amber-400 ml-1">未审</span>}
                        {item.isCurrent ? <span className="text-blue-400 ml-1">当前</span> : <span className="text-zinc-600 ml-1">非当前</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {preflight!.exportItems.length === 0 && totalCount > 0 && (
            <p className="text-xs text-red-400 py-4 text-center">没有可导出的视频片段</p>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-800 px-5 py-3 flex items-center gap-3 shrink-0">
          {canExport ? (
            <p className="text-[11px] text-green-400/80 flex-1">全部镜头视频已审核通过，将按当前版本导出完整视频。</p>
          ) : (
            <div className="flex-1 space-y-1">
              {!canExport && canPartialExport && (
                <p className="text-[11px] text-amber-400 font-medium">⚠ 部分镜头不可用，导出视频将不完整</p>
              )}
              <p className="text-[11px] text-zinc-500">
                {missingCount > 0 && "还有 " + missingCount + " 个镜头没有可用视频。"}
                {unapprovedCount > 0 && "有 " + unapprovedCount + " 个镜头视频未审核。"}
                {canPartialExport && " 你也可以选择部分导出，只导出已完成的视频片段。"}
              </p>
            </div>
          )}

          <button onClick={onClose} className="text-xs px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors">取消</button>

          {canPartialExport && (
            <button onClick={() => onConfirm(true)} className="text-xs px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-white font-medium transition-colors">部分导出</button>
          )}

          <button
            onClick={() => onConfirm(false)}
            disabled={!canExport}
            title={!canExport ? "请先补齐所有镜头视频并审核通过" : undefined}
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
      <div className={"text-sm font-medium " + className}>{value}</div>
    </div>
  );
}
