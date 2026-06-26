// =========================================================================
// useVideoClips 鈥?鍏变韩瑙嗛 clip 閫昏緫
// TimelineTrack 鍜?SceneVideoPanel 鍏辩敤鍚屼竴濂?clips 鍔犺浇 / 鐗堟湰閫夋嫨
// =========================================================================

import { useCallback } from "react";
import { useApi } from "./useApi";
import { useProjectStore } from "../stores/projectStore";
import type { VideoClip } from "@ai-video-canvas/shared";

export function useVideoClips() {
  const { get, post } = useApi();
  const clipsByScene = useProjectStore((s) => s.clipsByScene);

  /** 鎷夊彇鍏ㄩ儴 clips 骞跺啓鍏?store锛岃繑鍥炲師濮嬫暟鎹敤浜?isCurrent 閲嶅缓 */
  const fetchClips = useCallback(async () => {
    const project = useProjectStore.getState().currentProject;
    if (!project) return [];
    const data = await get<VideoClip[]>(`/projects/${project.id}/videos`);
    useProjectStore.getState().setAllClips(data);
    return data;
  }, [get]);

  /** 鑾峰彇鏌愪釜 scene 鐨勫綋鍓?clip锛坕sCurrent 浼樺厛锛屽叾娆℃渶鏂扮増鏈級 */
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

  /** 鎸佷箙鍖栫増鏈€夋嫨 鈫?fetchClips 鍥炶 鈫?杩斿洖 data */
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
