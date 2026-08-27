interface ElectronAPI {
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
  on: (channel: string, callback: (...args: unknown[]) => void) => () => void;
  send: (channel: string, ...args: unknown[]) => void;

  minimize: () => Promise<void>;
  maximize: () => Promise<void>;
  close: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
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
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
