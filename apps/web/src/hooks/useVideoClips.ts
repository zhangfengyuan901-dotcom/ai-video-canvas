// =========================================================================
// useVideoClips - shared video clip logic
// TimelineTrack and SceneVideoPanel share clips loading and version selection
// =========================================================================

import { useCallback } from "react";
import { useApi } from "./useApi";
import { useProjectStore } from "../stores/projectStore";
import type { VideoClip, VideoRetryResponse } from "@ai-video-canvas/shared";

export function useVideoClips() {
  const { get, post } = useApi();
  const clipsByScene = useProjectStore((s) => s.clipsByScene);

  /** Fetch all clips into store, return raw data for isCurrent rebuild */
  const fetchClips = useCallback(async () => {
    const project = useProjectStore.getState().currentProject;
    if (!project) return [];
    const data = await get<VideoClip[]>(`/projects/${project.id}/videos`);
    useProjectStore.getState().setAllClips(data);
    return data;
  }, [get]);

  /** Get current clip for a scene (isCurrent first, then latest version) */
  const getCurrentClip = useCallback(
    (sceneId: string) => {
      const clips = clipsByScene[sceneId] ?? [];
      if (clips.length === 0) return null;
      return clips.find((c) => c.isCurrent) ?? clips.reduce(
        (latest, c) => (c.version > latest.version ? c : latest),
        clips[0],
      );
    },
    [clipsByScene],
  );

  /** Persist version choice -> fetchClips re-read -> return data */
  const retryFailedClip = useCallback(
    async (sceneId: string, clipId: string, retryReason?: string) => {
      const project = useProjectStore.getState().currentProject;
      if (!project) return null;

      const result = await post<VideoRetryResponse>(
        `/projects/${project.id}/scenes/${sceneId}/videos/${clipId}/retry`,
        { retryReason },
      );

      await fetchClips();
      return result;
    },
    [post, fetchClips],
  );

  const selectVersion = useCallback(
    async (sceneId: string, clipId: string) => {
      const project = useProjectStore.getState().currentProject;
      if (!project) return [];
      await post(`/projects/${project.id}/scenes/${sceneId}/videos/${clipId}/use-version`);
      return await fetchClips();
    },
    [post, fetchClips],
  );

  return { clipsByScene, fetchClips, getCurrentClip, selectVersion, retryFailedClip };
}
