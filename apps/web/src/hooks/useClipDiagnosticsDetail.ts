// =========================================================================
// useClipDiagnosticsDetail — 加载完整 RunningHub diagnostics
// 供 ClipDiagnosticsPanel 和 ClipDiagnosticsDrawer 共用。
// 同一个 clip.id 默认只加载一次，调用 reload() 可强制刷新。
// =========================================================================

import { useCallback, useEffect, useState } from "react";
import { useApi } from "./useApi";
import type {
  RunningHubClipDiagnostics,
  VideoClip,
  VideoClipDiagnosticsDetail,
} from "@ai-video-canvas/shared";

export function useClipDiagnosticsDetail(clip: VideoClip | null) {
  const { get } = useApi();
  const [diagnostics, setDiagnostics] = useState<RunningHubClipDiagnostics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Reset when clip changes
  useEffect(() => {
    setDiagnostics(null);
    setLoading(false);
    setError(null);
    setLoaded(false);
  }, [clip?.id]);

  // Load once per clip
  const load = useCallback(async () => {
    if (!clip || loading || loaded) return;

    setLoading(true);
    setError(null);

    try {
      const detail = await get<VideoClipDiagnosticsDetail>(
        `/projects/${clip.projectId}/scenes/${clip.sceneId}/videos/${clip.id}/diagnostics`,
      );
      setDiagnostics(detail.diagnostics);
      setLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "诊断详情加载失败");
    } finally {
      setLoading(false);
    }
  }, [clip?.id, clip?.projectId, clip?.sceneId, get, loading, loaded]);

  // Force reload
  const reload = useCallback(async () => {
    if (!clip) return;

    setLoaded(false);
    setDiagnostics(null);
    setError(null);
    setLoading(true);

    try {
      const detail = await get<VideoClipDiagnosticsDetail>(
        `/projects/${clip.projectId}/scenes/${clip.sceneId}/videos/${clip.id}/diagnostics`,
      );
      setDiagnostics(detail.diagnostics);
      setLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "诊断详情加载失败");
    } finally {
      setLoading(false);
    }
  }, [clip?.id, clip?.projectId, clip?.sceneId, get]);

  return {
    diagnostics: diagnostics ?? clip?.diagnostics ?? null,
    fullDiagnostics: diagnostics,
    loading,
    error,
    loaded,
    load,
    reload,
  };
}
