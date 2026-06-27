import { create } from "zustand";
import {
  getConfig,
  saveConfig,
  type AppConfig,
  type ThemeConfig,
  type A11yConfig,
  type BackgroundConfig,
  type GameConfig,
  type JavaConfig,
  type AdvancedConfig,
  type DownloadConfig,
  type NetworkConfig,
} from "@/api/config";
import { DEFAULT_BG } from "@/lib/mode";

// TODO: re-enable when ready
// let saveTimer: ReturnType<typeof setTimeout> | null = null;
// function debouncedSave(config: AppConfig) {
//   if (saveTimer) clearTimeout(saveTimer);
//   saveTimer = setTimeout(() => {
//     saveConfig(config).catch((e) => {
//       console.error("[config] save failed:", e);
//     });
//   }, 300);
// }

interface ConfigState {
  config: AppConfig;
  loaded: boolean;

  init: () => Promise<void>;
  setTheme: (patch: Partial<ThemeConfig>) => void;
  setA11y: (patch: Partial<A11yConfig>) => void;
  setBackground: (patch: Partial<BackgroundConfig>) => void;
  setGame: (patch: Partial<GameConfig>) => void;
  setJava: (patch: Partial<JavaConfig>) => void;
  setAdvanced: (patch: Partial<AdvancedConfig>) => void;
  setDownload: (patch: Partial<DownloadConfig>) => void;
  setNetwork: (patch: Partial<NetworkConfig>) => void;
}

const DEFAULT_CONFIG: AppConfig = {
  version: 1,
  theme: { darkMode: "auto", parallax: true },
  a11y: { reduceMotion: false, reduceTransparency: false, highContrast: false, contentBlurOpacity: 50 },
  background: { bgType: "image", image: DEFAULT_BG, blur: 0, opacity: 100 },
  game: { gameDir: ".minecraft", resourceDir: "", savesDir: "", instancesDir: ".minecraft/instances" },
  java: { javaPath: "", memMode: "auto", memGB: 4, gc: "auto", jvmArgs: "" },
  advanced: { afterLaunch: "close", winMode: "default", customWidth: 854, customHeight: 480, gameArgs: "", preLaunchCmd: "", debugMode: false },
  download: { fileSource: "mirror", versionSource: "mirror", threads: 16, speedLimit: 0 },
  network: { securityId: { enabled: false, authUrl: "" } },
};

export const useConfigStore = create<ConfigState>((set, get) => ({
  config: DEFAULT_CONFIG,
  loaded: false,

  init: async () => {
    // TODO: re-enable when ready — load from Rust/Koring.yml
    // try {
    //   const config = await getConfig();
    //   set({ config, loaded: true });
    // } catch (e) {
    //   console.error("[config] init failed, using defaults:", e);
    //   set({ loaded: true });
    // }
    set({ loaded: true });
  },

  setTheme: (patch) => {
    const { config } = get();
    set({ config: { ...config, theme: { ...config.theme, ...patch } } });
  },

  setA11y: (patch) => {
    const { config } = get();
    set({ config: { ...config, a11y: { ...config.a11y, ...patch } } });
  },

  setBackground: (patch) => {
    const { config } = get();
    set({ config: { ...config, background: { ...config.background, ...patch } } });
  },

  setGame: (patch) => {
    const { config } = get();
    set({ config: { ...config, game: { ...config.game, ...patch } } });
  },

  setJava: (patch) => {
    const { config } = get();
    set({ config: { ...config, java: { ...config.java, ...patch } } });
  },

  setAdvanced: (patch) => {
    const { config } = get();
    set({ config: { ...config, advanced: { ...config.advanced, ...patch } } });
  },

  setDownload: (patch) => {
    const { config } = get();
    set({ config: { ...config, download: { ...config.download, ...patch } } });
  },

  setNetwork: (patch) => {
    const { config } = get();
    set({ config: { ...config, network: { ...config.network, ...patch } } });
  },
}));
