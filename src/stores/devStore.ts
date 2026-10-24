import { create } from "zustand";

export type PreviewUpdateState = "latest" | "hasUpdate" | "installed";

interface DevState {
  forceDisableContentBlur: boolean;
  setForceDisableContentBlur: (v: boolean) => void;

  previewMode: string | null;
  setPreviewMode: (v: string | null) => void;

  previewUpdateState: PreviewUpdateState | null;
  setPreviewUpdateState: (v: PreviewUpdateState | null) => void;
}

export const useDevStore = create<DevState>((set) => ({
  forceDisableContentBlur: false,
  setForceDisableContentBlur: (v) => set({ forceDisableContentBlur: v }),

  previewMode: null,
  setPreviewMode: (v) => set({ previewMode: v }),

  previewUpdateState: null,
  setPreviewUpdateState: (v) => set({ previewUpdateState: v }),
}));
