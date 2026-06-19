import { create } from "zustand";
import {
  setImageBackground,
  setColorBackground,
  setBackgroundBlur,
  setBackgroundOpacity,
  setBackgroundAnimation,
  getBackgroundConfig,
  setTheme,
  resetBackground,
} from "../api/background";
import type { AnimationType, Theme, BackgroundConfig } from "../api/background";

interface BackgroundState {
  type: "image" | "color" | "gradient" | "particles";
  image?: string;
  color?: string;
  blur: number;
  opacity: number;
  animation: AnimationType;
  animationSpeed: number;
  theme: Theme;
  loading: boolean;
  error: string | null;

  setImage: (url: string, blur?: number, opacity?: number) => Promise<void>;
  setColor: (color: string) => Promise<void>;
  setBlur: (blur: number) => Promise<void>;
  setOpacity: (opacity: number) => Promise<void>;
  setAnimation: (type: AnimationType, speed?: number) => Promise<void>;
  setTheme: (theme: Theme) => Promise<void>;
  fetchConfig: () => Promise<void>;
  reset: () => Promise<void>;
  clearError: () => void;
}

const defaultConfig: BackgroundConfig = {
  type: "color",
  color: "#1a1a2e",
  blur: 0,
  opacity: 1,
  animation: "none",
  animationSpeed: 1,
  theme: "dark",
};

export const useBackgroundStore = create<BackgroundState>((set) => ({
  ...defaultConfig,
  loading: false,
  error: null,

  setImage: async (url, blur, opacity) => {
    set({ loading: true, error: null });
    try {
      const config = await setImageBackground(url, blur, opacity);
      set({ ...config, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  setColor: async (color) => {
    set({ loading: true, error: null });
    try {
      const config = await setColorBackground(color);
      set({ ...config, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  setBlur: async (blur) => {
    set({ loading: true, error: null });
    try {
      const config = await setBackgroundBlur(blur);
      set({ ...config, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  setOpacity: async (opacity) => {
    set({ loading: true, error: null });
    try {
      const config = await setBackgroundOpacity(opacity);
      set({ ...config, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  setAnimation: async (type, speed) => {
    set({ loading: true, error: null });
    try {
      const config = await setBackgroundAnimation(type, speed);
      set({ ...config, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  setTheme: async (theme) => {
    set({ loading: true, error: null });
    try {
      const config = await setTheme(theme);
      set({ ...config, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  fetchConfig: async () => {
    set({ loading: true, error: null });
    try {
      const config = await getBackgroundConfig();
      set({ ...config, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  reset: async () => {
    set({ loading: true, error: null });
    try {
      const config = await resetBackground();
      set({ ...config, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
