import { create } from "zustand";
import { useConfigStore } from "./configStore";

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

  setReduceMotion: (v) => {
    set({ reduceMotion: v });
    useConfigStore.getState().setA11y({ reduceMotion: v });
  },
  setReduceTransparency: (v) => {
    set({ reduceTransparency: v });
    useConfigStore.getState().setA11y({ reduceTransparency: v });
  },
  setHighContrast: (v) => {
    set({ highContrast: v });
    useConfigStore.getState().setA11y({ highContrast: v });
  },
  setContentBlurOpacity: (v) => {
    set({ contentBlurOpacity: v });
    useConfigStore.getState().setA11y({ contentBlurOpacity: v });
  },
}));

export function syncA11yFromConfig() {
  const { a11y } = useConfigStore.getState().config;
  useA11yStore.setState({
    reduceMotion: a11y.reduceMotion,
    reduceTransparency: a11y.reduceTransparency,
    highContrast: a11y.highContrast,
    contentBlurOpacity: a11y.contentBlurOpacity,
  });
}
