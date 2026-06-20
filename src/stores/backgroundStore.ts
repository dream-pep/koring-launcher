import { create } from "zustand";

const STORAGE_KEY = "koring-background";

type BackgroundType = "image" | "color";

interface BackgroundConfig {
  type: BackgroundType;
  image: string;
  blur: number;
  opacity: number;
}

const DEFAULT_CONFIG: BackgroundConfig = {
  type: "image",
  image: "/background.png",
  blur: 0,
  opacity: 1,
};

function loadConfig(): BackgroundConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_CONFIG };
}

function saveConfig(config: BackgroundConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

interface BackgroundState extends BackgroundConfig {
  setImage: (url: string) => void;
  setColor: (color: string) => void;
  setBlur: (blur: number) => void;
  setOpacity: (opacity: number) => void;
  reset: () => void;
}

export const useBackgroundStore = create<BackgroundState>((set) => ({
  ...loadConfig(),

  setImage: (url) => {
    const next: BackgroundConfig = { type: "image", image: url, blur: 0, opacity: 1 };
    saveConfig(next);
    set(next);
  },

  setColor: (color) => {
    const next: BackgroundConfig = { type: "color", image: color, blur: 0, opacity: 1 };
    saveConfig(next);
    set(next);
  },

  setBlur: (blur) => {
    const config = loadConfig();
    config.blur = blur;
    saveConfig(config);
    set({ blur });
  },

  setOpacity: (opacity) => {
    const config = loadConfig();
    config.opacity = opacity;
    saveConfig(config);
    set({ opacity });
  },

  reset: () => {
    saveConfig(DEFAULT_CONFIG);
    set({ ...DEFAULT_CONFIG });
  },
}));
