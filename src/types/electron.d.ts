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

  onRuntimeNotice: (callback: (notice: { kind: string; message: string }) => void) => () => void;

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
  /** 图片模式：多选图片导入，返回更新后的轮换列表 */
  pickBackgroundImages: () => Promise<string[]>;
  /** 视频模式：选择视频文件（复制进 userData，不重编码），返回文件路径 */
  pickBackgroundVideo: () => Promise<string | null>;
  /** GIF 模式：选择 GIF 动图，返回文件路径 */
  pickBackgroundGif: () => Promise<string | null>;
  resolveBackgroundResource: (value: string) => Promise<{ url: string | null; bytes: number }>;

  // Auto-update
  checkForUpdates: (manual?: boolean, targetVersion?: string) => Promise<unknown>;
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

  // Forced update（强制升级页面）
  prepareForcedUpdate: (targetVersion?: string) => Promise<unknown>;
  installForcedUpdate: () => Promise<unknown>;
  getForcedUpdateState: () => Promise<unknown>;
  onForcedUpdateStatus: (callback: (data: unknown) => void) => () => void;

  // 陶瓦联机（Terracotta）：HTTP 只在主进程，渲染端只收发状态
  terracottaStatus: () => Promise<unknown>;
  terracottaInstall: (force?: boolean) => Promise<unknown>;
  terracottaStart: (payload?: { player?: string }) => Promise<unknown>;
  terracottaStop: () => Promise<unknown>;
  terracottaHost: (payload?: { player?: string; publicNodes?: string[] }) => Promise<unknown>;
  terracottaGuest: (payload: { room: string; player?: string; publicNodes?: string[] }) => Promise<unknown>;
  terracottaReset: () => Promise<unknown>;
  terracottaFetchLog: () => Promise<unknown>;
  terracottaOpenDir: () => Promise<unknown>;
  terracottaPickBinary: () => Promise<unknown>;
  terracottaClearBinary: () => Promise<unknown>;
  onTerracottaStatus: (callback: (data: unknown) => void) => () => void;
  onTerracottaInstallProgress: (callback: (data: unknown) => void) => () => void;

  // Koring Account 启动器 API（主进程发起；见 electron/core/launcher-api.ts）
  launcherEnvInfo: () => Promise<unknown>;
  launcherDeviceCheck: () => Promise<unknown>;
  launcherVersionPolicy: (version?: string) => Promise<unknown>;
  launcherStartupCheck: (force?: boolean) => Promise<unknown>;
  launcherDeviceUuid: () => Promise<unknown>;
  launcherDeviceStatus: () => Promise<unknown>;
  launcherDeviceReport: () => Promise<unknown>;
  launcherDeviceNotifications: () => Promise<unknown>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

// Electron 无边框窗口的拖拽区域（React 的 CSSProperties 未内置）
declare module "react" {
  interface CSSProperties {
    WebkitAppRegion?: "drag" | "no-drag";
  }
}

export {};
