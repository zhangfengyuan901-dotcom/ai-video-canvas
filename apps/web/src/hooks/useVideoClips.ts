// =========================================================================
// useVideoClips — 共享视频 clip 逻辑
// TimelineTrack 和 SceneVideoPanel 共用同一套 clips 加载 / 版本选择
// =========================================================================

import { useCallback } from "react";
import { useApi } from "./useApi";
import { useProjectStore } from "../stores/projectStore";
import type { VideoClip } from "@ai-video-canvas/shared";

export function useVideoClips() {
  const { get, post } = useApi();
  const clipsByScene = useProjectStore((s) => s.clipsByScene);

  /** 拉取全部 clips 并写入 store，返回原始数据用于 isCurrent 重建 */
  const fetchClips = useCallback(async () => {
    const project = useProjectStore.getState().currentProject;
    if (!project) return [];
    const data = await get<any[]>(`/projects/${project.id}/videos`);
    useProjectStore.getState().setAllClips(data);
    return data;
  }, [get]);

  /** 获取某个 scene 的当前 clip（isCurrent 优先，其次最新版本） */
  const getCurrentClip = useCallback(
    (sceneId: string) => {
      const clips = clipsByScene[sceneId] ?? [];
      if (clips.length === 0) return null;
      return clips.find((c: any) => c.isCurrent) ?? clips.reduce(
        (latest, c) => (c.version > latest.version ? c : latest),
        clips[0],
      );
    },
    [clipsByScene],
  );

  /** 持久化版本选择 → fetchClips 回读 → 返回 data */
  const selectVersion = useCallback(
    async (sceneId: string, clipId: string) => {
      const project = useProjectStore.getState().currentProject;
      if (!project) return [];
      await post(`/projects/${project.id}/scenes/${sceneId}/videos/${clipId}/use-version`);
      return await fetchClips();
    },
    [post, fetchClips],
  );

  return { clipsByScene, fetchClips, getCurrentClip, selectVersion };
}
