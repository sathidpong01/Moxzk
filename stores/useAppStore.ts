import { create } from "zustand";
import { MangaPage } from "@/lib/gemini";

interface AppState {
  file: File | null;
  previewUrl: string | null;
  isProcessing: boolean;
  result: MangaPage | null;
  scale: number;
  viewMode: "original" | "translated";
  downloadTrigger: number;
  
  // Actions
  setFile: (file: File) => void;
  setPreviewUrl: (url: string) => void;
  setIsProcessing: (isProcessing: boolean) => void;
  setResult: (result: MangaPage | null) => void;
  setScale: (scale: number) => void;
  setViewMode: (mode: "original" | "translated") => void;
  triggerDownload: () => void;
  reset: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  file: null,
  previewUrl: null,
  isProcessing: false,
  result: null,
  scale: 1,
  viewMode: "original",
  downloadTrigger: 0,

  setFile: (file) => set({ file }),
  setPreviewUrl: (previewUrl) => set({ previewUrl }),
  setIsProcessing: (isProcessing) => set({ isProcessing }),
  setResult: (result) => set({ result }),
  setScale: (scale) => set({ scale }),
  setViewMode: (viewMode) => set({ viewMode }),
  triggerDownload: () => set((state) => ({ downloadTrigger: state.downloadTrigger + 1 })),
  reset: () =>
    set({
      file: null,
      previewUrl: null,
      isProcessing: false,
      result: null,
      scale: 1,
      viewMode: "original",
      downloadTrigger: 0,
    }),
}));
