// =========================================================================
// Project + Scene + Timeline + Video state (Zustand)
// =========================================================================

import { create } from "zustand";
import type { Project, Scene, StoryboardPanel, VideoClip, ReferenceAsset } from "@ai-video-canvas/shared";

interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  scenes: Scene[];
  selectedSceneId: string | null;
  panelsByScene: Record<string, StoryboardPanel[]>;
  isGeneratingStoryboard: boolean;

  // Video clips (Phase 4)
  clipsByScene: Record<string, VideoClip[]>;
  isGeneratingVideo: boolean;

  // Actions
  setProjects: (list: Project[]) => void;
  setCurrentProject: (p: Project | null) => void;
  setScenes: (list: Scene[]) => void;
  reorderScenes: (sceneIds: string[]) => void;
  selectScene: (id: string | null) => void;
  createProject: (p: Project) => void;
  setPanels: (sceneId: string, panels: StoryboardPanel[]) => void;
  setGeneratingStoryboard: (v: boolean) => void;

  // Reference assets
  referenceAssets: ReferenceAsset[];
  setReferenceAssets: (list: ReferenceAsset[]) => void;
  addReferenceAsset: (asset: ReferenceAsset) => void;
  updateReferenceAsset: (assetId: string, updates: Partial<ReferenceAsset>) => void;
  removeReferenceAsset: (assetId: string) => void;

  // Video actions
  setClips: (sceneId: string, clips: VideoClip[]) => void;
  setAllClips: (clips: VideoClip[]) => void;
  setGeneratingVideo: (v: boolean) => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  projects: [],
  currentProject: null,
  scenes: [],
  selectedSceneId: null,
  panelsByScene: {},
  isGeneratingStoryboard: false,
  clipsByScene: {},
  isGeneratingVideo: false,
  referenceAssets: [],

  setProjects: (projects) => set({ projects }),
  setCurrentProject: (currentProject) => set({ currentProject }),
  setScenes: (scenes) => set({ scenes }),
  reorderScenes: (sceneIds) =>
    set((s) => {
      const orderMap = new Map(sceneIds.map((id, i) => [id, i + 1]));
      const reordered = sceneIds
        .map((id) => s.scenes.find((sc) => sc.id === id))
        .filter(Boolean) as Scene[];
      return {
        scenes: reordered.map((sc) => ({ ...sc, order: orderMap.get(sc.id) ?? sc.order })),
      };
    }),
  selectScene: (selectedSceneId) => set({ selectedSceneId }),
  createProject: (project) =>
    set((s) => ({
      projects: [...s.projects, project],
      currentProject: project,
    })),
  setPanels: (sceneId, panels) =>
    set((s) => ({ panelsByScene: { ...s.panelsByScene, [sceneId]: panels } })),
  setGeneratingStoryboard: (isGeneratingStoryboard) => set({ isGeneratingStoryboard }),

  setClips: (sceneId, clips) =>
    set((s) => ({ clipsByScene: { ...s.clipsByScene, [sceneId]: clips } })),
  setAllClips: (clips) =>
    set(() => {
      const byScene: Record<string, VideoClip[]> = {};
      for (const clip of clips) {
        if (!byScene[clip.sceneId]) byScene[clip.sceneId] = [];
        byScene[clip.sceneId].push(clip);
      }
      return { clipsByScene: byScene };
    }),
  setGeneratingVideo: (isGeneratingVideo) => set({ isGeneratingVideo }),

  setReferenceAssets: (referenceAssets) => set({ referenceAssets }),
  addReferenceAsset: (asset) => set((s) => ({ referenceAssets: [...s.referenceAssets, asset] })),
  updateReferenceAsset: (assetId, updates) =>
    set((s) => ({
      referenceAssets: s.referenceAssets.map((a) => (a.id === assetId ? { ...a, ...updates } : a)),
    })),
  removeReferenceAsset: (assetId) =>
    set((s) => ({
      referenceAssets: s.referenceAssets.filter((a) => a.id !== assetId),
    })),
}));
