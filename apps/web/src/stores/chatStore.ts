// =========================================================================
// Chat state (Zustand)
// =========================================================================

import { create } from "zustand";
import type { ChatMessage } from "@ai-video-canvas/shared";

interface ChatState {
  messages: ChatMessage[];
  isGenerating: boolean;
  error: string | null;

  addMessage: (msg: ChatMessage) => void;
  setGenerating: (v: boolean) => void;
  setError: (e: string | null) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isGenerating: false,
  error: null,

  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setGenerating: (isGenerating) => set({ isGenerating }),
  setError: (error) => set({ error }),
  clearMessages: () => set({ messages: [], error: null }),
}));
