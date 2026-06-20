import { create } from "zustand";

interface A11yState {
  reduceMotion: boolean;
  reduceTransparency: boolean;
  highContrast: boolean;
  contentBlurOpacity: number;
  setReduceMotion: (v: boolean) => void;
  setReduceTransparency: (v: boolean) => void;
  setHighContrast: (v: boolean) => void;
  setContentBlurOpacity: (v: number) => void;
}

export const useA11yStore = create<A11yState>((set) => ({
  reduceMotion: false,
  reduceTransparency: false,
  highContrast: false,
  contentBlurOpacity: 50,

  setReduceMotion: (v) => set({ reduceMotion: v }),
  setReduceTransparency: (v) => set({ reduceTransparency: v }),
  setHighContrast: (v) => set({ highContrast: v }),
  setContentBlurOpacity: (v) => set({ contentBlurOpacity: v }),
}));
