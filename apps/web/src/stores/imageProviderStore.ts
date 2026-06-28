// =========================================================================
// imageProviderStore — which image generation provider to use
// =========================================================================

import { create } from "zustand";

type ImageProvider = "packy" | "runninghub";

interface ImageProviderState {
  provider: ImageProvider;
  runninghubImageModel: string; // "1" - "5"
  setProvider: (p: ImageProvider) => void;
  setRunninghubImageModel: (id: string) => void;
}

export const useImageProviderStore = create<ImageProviderState>((set) => ({
  provider: "packy",
  runninghubImageModel: "1",
  setProvider: (provider) => set({ provider }),
  setRunninghubImageModel: (id) => set({ runninghubImageModel: id }),
}));
