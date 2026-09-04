interface ElectronAPI {
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
  on: (channel: string, callback: (...args: unknown[]) => void) => () => void;
  send: (channel: string, ...args: unknown[]) => void;

  minimize: () => Promise<void>;
  maximize: () => Promise<void>;
  close: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
  openDevTools: () => Promise<unknown>;
  onResized: (callback: () => void) => () => void;

  getTheme: () => Promise<'light' | 'dark' | 'system' | null>;

  onConfigPreload: (callback: (data: { config: unknown; isFirstLaunch: boolean }) => void) => () => void;

  onConfigChanged: (callback: (config: unknown) => void) => () => void;

  openExternal: (url: string) => Promise<void>;

  // Crash monitoring
  simulateCrash: () => Promise<void>;
  testCrashDialog: () => Promise<void>;

  // Config reset
  resetConfig: () => Promise<void>;

  // 渲染端日志 → 主进程统一日志（debug 模式写文件）
  log: (level: "debug" | "info" | "warn" | "error", scope: string, message: string) => void;

  // 壁纸（文件路径存储 → koring-res:// 资源引用，不使用 BASE64）
  pickBackgroundImage: () => Promise<string | null>;
  resolveBackgroundResource: (value: string) => Promise<{ url: string | null; bytes: number }>;

  // Auto-update
  checkForUpdates: (manual?: boolean) => Promise<unknown>;
  downloadUpdate: () => Promise<unknown>;
  pauseUpdate: () => Promise<unknown>;
  resumeUpdate: () => Promise<unknown>;
  cancelUpdate: () => Promise<unknown>;
  quitAndInstall: () => Promise<unknown>;
  getUpdateState: () => Promise<unknown>;
  getReleaseNotes: (tag?: string) => Promise<unknown>;
  getUpdateChannels: () => Promise<unknown>;
  setUpdateChannel: (channel: string) => Promise<unknown>;
  setTestVersion: (version: string) => Promise<unknown>;
  compareVersions: (a: string, b: string) => Promise<unknown>;
  onUpdateStatus: (callback: (data: unknown) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
