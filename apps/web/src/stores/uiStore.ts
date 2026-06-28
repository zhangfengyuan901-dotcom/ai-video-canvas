// =========================================================================
// uiStore — Global UI-only state (diagnostic drawer, API status, etc.)
// =========================================================================

import { create } from "zustand";
import type { VideoClip } from "@ai-video-canvas/shared";

interface UIState {
  // Diagnostic drawer
  diagnosticDrawerOpen: boolean;
  diagnosticClip: VideoClip | null;
  openDiagnosticDrawer: (clip: VideoClip) => void;
  closeDiagnosticDrawer: () => void;

  // API health status
  apiStatus: "connected" | "disconnected" | "checking";
  setApiStatus: (status: "connected" | "disconnected" | "checking") => void;
}

export const useUIStore = create<UIState>((set) => ({
  diagnosticDrawerOpen: false,
  diagnosticClip: null,
  openDiagnosticDrawer: (clip) => set({ diagnosticDrawerOpen: true, diagnosticClip: clip }),
  closeDiagnosticDrawer: () => set({ diagnosticDrawerOpen: false, diagnosticClip: null }),

  apiStatus: "checking",
  setApiStatus: (apiStatus) => set({ apiStatus }),
}));
