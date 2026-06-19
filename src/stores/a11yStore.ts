import { create } from "zustand";

interface A11yState {
  reduceMotion: boolean;
  reduceTransparency: boolean;
  highContrast: boolean;
  setReduceMotion: (v: boolean) => void;
  setReduceTransparency: (v: boolean) => void;
  setHighContrast: (v: boolean) => void;
}

export const useA11yStore = create<A11yState>((set) => ({
  reduceMotion: false,
  reduceTransparency: false,
  highContrast: false,

  setReduceMotion: (v) => set({ reduceMotion: v }),
  setReduceTransparency: (v) => set({ reduceTransparency: v }),
  setHighContrast: (v) => set({ highContrast: v }),
}));
