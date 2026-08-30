import { create } from "zustand";
import {
  getConfig,
  updateConfig,
  type AppConfig,
  type AppInfoConfig,
  type ThemeConfig,
  type A11yConfig,
  type BackgroundConfig,
  type GameConfig,
  type JavaConfig,
  type AdvancedConfig,
  type DownloadConfig,
  type NetworkConfig,
  type UiConfig,
  type InstanceMeta,
} from "@/api/config";
import { DEFAULT_BG } from "@/lib/mode";

/**
 * 配置 store（主进程权威模型的渲染端镜像）：
 * - 启动时由 config:preload / config:get 填充
 * - 所有 setX 只向主进程提交 { section, patch }（config:update），不直接写盘
 * - 主进程合并后广播 config:changed，收到后以广播为准覆盖本地
 */

interface ConfigState {
  config: AppConfig;
  loaded: boolean;
  isFirstLaunch: boolean;

  init: () => Promise<void>;
  applyPreloaded: (config: AppConfig, isFirstLaunch: boolean) => void;
  applyChanged: (config: AppConfig) => void;
  setApp: (patch: Partial<AppInfoConfig>) => void;
  setTheme: (patch: Partial<ThemeConfig>) => void;
  setA11y: (patch: Partial<A11yConfig>) => void;
  setBackground: (patch: Partial<BackgroundConfig>) => void;
  setGame: (patch: Partial<GameConfig>) => void;
  setJava: (patch: Partial<JavaConfig>) => void;
  setAdvanced: (patch: Partial<AdvancedConfig>) => void;
  setDownload: (patch: Partial<DownloadConfig>) => void;
  setNetwork: (patch: Partial<NetworkConfig>) => void;
  setUi: (patch: Partial<UiConfig>) => void;
  setInstances: (instances: InstanceMeta[]) => void;
  setOobe: (value: boolean) => void;
}

const DEFAULT_CONFIG: AppConfig = {
  version: 1,
  oobe: true,
  app: { language: "zh-CN" },
  theme: { darkMode: "auto", parallax: true },
  a11y: { reduceMotion: false, reduceTransparency: false, highContrast: false, contentBlurOpacity: 50 },
  background: { bgType: "image", image: DEFAULT_BG, blur: 0, opacity: 100 },
  game: { gameDir: ".minecraft", resourceDir: "", savesDir: "", instancesDir: ".minecraft/instances", gameDirs: [] },
  java: { javaPath: "", memMode: "auto", memGB: 4, gc: "auto", jvmArgs: "" },
  advanced: { afterLaunch: "close", winMode: "default", customWidth: 854, customHeight: 480, gameArgs: "", preLaunchCmd: "", debugMode: false, server: { ip: "", port: 25565 } },
  download: { fileSource: "mirror", versionSource: "mirror", threads: 16, speedLimit: 0 },
  network: { securityId: { enabled: false, authUrl: "" } },
  ui: { showInstanceTitle: true, showTaskButton: true },
  update: { state: "idle", version: "", percent: 0, transferred: 0, total: 0, source: "github", channel: "woker", error: "" },
  instances: [],
};

// 乐观更新本地 + 提交主进程；主进程广播回来时以广播为准（applyChanged 覆盖）
function submit(section: string, patch: unknown) {
  updateConfig(section, patch).catch((e) => {
    console.error(`[config] update ${section} failed:`, e);
  });
}

export const useConfigStore = create<ConfigState>((set, get) => ({
  config: DEFAULT_CONFIG,
  loaded: false,
  isFirstLaunch: false,

  applyPreloaded: (config, isFirstLaunch) => {
    set({ config, isFirstLaunch, loaded: true });
  },

  // 主进程广播的权威配置 → 整体覆盖本地镜像
  applyChanged: (config) => {
    set({ config, loaded: true });
  },

  init: async () => {
    // If already preloaded, skip IPC call
    if (get().loaded) return;
    try {
      const config = await getConfig();
      set({ config, loaded: true });
    } catch (e) {
      console.error("[config] init failed, using defaults:", e);
      set({ loaded: true });
    }
  },

  setApp: (patch) => {
    const { config } = get();
    set({ config: { ...config, app: { ...config.app, ...patch } } });
    submit("app", patch);
  },

  setTheme: (patch) => {
    const { config } = get();
    set({ config: { ...config, theme: { ...config.theme, ...patch } } });
    submit("theme", patch);
  },

  setA11y: (patch) => {
    const { config } = get();
    set({ config: { ...config, a11y: { ...config.a11y, ...patch } } });
    submit("a11y", patch);
  },

  setBackground: (patch) => {
    const { config } = get();
    set({ config: { ...config, background: { ...config.background, ...patch } } });
    submit("background", patch);
  },

  setGame: (patch) => {
    const { config } = get();
    set({ config: { ...config, game: { ...config.game, ...patch } } });
    submit("game", patch);
  },

  setJava: (patch) => {
    const { config } = get();
    set({ config: { ...config, java: { ...config.java, ...patch } } });
    submit("java", patch);
  },

  setAdvanced: (patch) => {
    const { config } = get();
    set({ config: { ...config, advanced: { ...config.advanced, ...patch } } });
    submit("advanced", patch);
  },

  setDownload: (patch) => {
    const { config } = get();
    set({ config: { ...config, download: { ...config.download, ...patch } } });
    submit("download", patch);
  },

  setNetwork: (patch) => {
    const { config } = get();
    set({ config: { ...config, network: { ...config.network, ...patch } } });
    submit("network", patch);
  },

  setUi: (patch) => {
    const { config } = get();
    set({ config: { ...config, ui: { ...config.ui, ...patch } } });
    submit("ui", patch);
  },

  setInstances: (instances) => {
    const { config } = get();
    set({ config: { ...config, instances } });
    submit("instances", instances);
  },

  setOobe: (value) => {
    const { config } = get();
    set({ config: { ...config, oobe: value } });
    submit("oobe", value);
  },
}));
