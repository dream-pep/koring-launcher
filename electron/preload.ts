import electron from 'electron';
const { contextBridge, ipcRenderer } = electron;

// 按当前窗口实际像素需求计算壁纸长边上限（含高分屏余量），
// 主进程据此把大图压到「屏幕可见」尺寸后落盘（配置只存文件路径，不存 BASE64）。
function computeMaxEdge(): number {
  const dpr = window.devicePixelRatio || 1;
  const css = Math.max(window.innerWidth || 1280, window.innerHeight || 800);
  const target = Math.round(Math.max(css, 1920) * dpr * 1.1);
  return Math.min(4096, Math.max(1920, target));
}

contextBridge.exposeInMainWorld('electronAPI', {
  // Generic IPC
  invoke: (channel: string, ...args: unknown[]) =>
    ipcRenderer.invoke(channel, ...args),

  on: (channel: string, callback: (...args: unknown[]) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => callback(...args);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  },

  send: (channel: string, ...args: unknown[]) =>
    ipcRenderer.send(channel, ...args),

  // Window controls
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  openDevTools: () => ipcRenderer.invoke('window:openDevTools'),
  onResized: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('window:resized', handler);
    return () => ipcRenderer.removeListener('window:resized', handler);
  },

  // Theme
  getTheme: () => ipcRenderer.invoke('window:getTheme'),

  // Config preloading
  onConfigPreload: (callback: (data: { config: unknown; isFirstLaunch: boolean }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { config: unknown; isFirstLaunch: boolean }) => callback(data);
    ipcRenderer.on('config:preload', handler);
    return () => ipcRenderer.removeListener('config:preload', handler);
  },

  // Config changed broadcast (authoritative full config from main process)
  onConfigChanged: (callback: (config: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, config: unknown) => callback(config);
    ipcRenderer.on('config:changed', handler);
    return () => ipcRenderer.removeListener('config:changed', handler);
  },

  // 主进程运行时提示（如 Linux 未以 AppImage 方式运行，影响更新组件）
  onRuntimeNotice: (callback: (notice: { kind: string; message: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, notice: { kind: string; message: string }) => callback(notice);
    ipcRenderer.on('runtime:notice', handler);
    return () => ipcRenderer.removeListener('runtime:notice', handler);
  },

  // 背景图 — 选择本地图片：主进程复制到 userData、按窗口尺寸优化并落盘，
  // 返回【文件路径】（配置/Store 以路径保存，不使用 BASE64）。
  pickBackgroundImage: async (): Promise<string | null> => {
    const result = await ipcRenderer.invoke('dialog:openFile', {
      filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] }],
    });
    if (!result) return null;
    const { srcPath } = result as { srcPath: string };
    const imported = await ipcRenderer.invoke('background:import', {
      srcPath,
      maxEdge: computeMaxEdge(),
    });
    if (imported && imported.success && typeof imported.data?.filePath === 'string' && imported.data.filePath) {
      return imported.data.filePath;
    }
    return null;
  },

  // 把配置文件/Store 中的壁纸值解析为可显示的资源引用：
  // data:/http(s):/file: 及 /、./ 相对 URL → 原样返回；
  // userData 内受管壁纸文件路径 → koring-res:// 协议 URL（流式读取，无 base64 副本）。
  resolveBackgroundResource: async (value: string): Promise<{ url: string | null; bytes: number }> => {
    try {
      const result = await ipcRenderer.invoke('background:resolve', { value });
      if (result && result.success && typeof result.data?.url === 'string' && result.data.url) {
        return { url: result.data.url, bytes: typeof result.data.bytes === 'number' ? result.data.bytes : 0 };
      }
    } catch {
      // fallthrough
    }
    return { url: null, bytes: 0 };
  },

  // 日志：渲染端经 IPC 汇入主进程统一日志（debug 模式写文件；否则仅控制台）
  log: (level: 'debug' | 'info' | 'warn' | 'error', scope: string, message: string) => {
    ipcRenderer.send('log:write', { level, scope, message });
  },

  // Open external URL in system browser
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),

  // Crash monitoring — devtools only
  simulateCrash: () => ipcRenderer.invoke('crash:simulate'),
  testCrashDialog: () => ipcRenderer.invoke('crash:testDialog'),

  // Config reset
  resetConfig: () => ipcRenderer.invoke('config:reset'),

  // Auto-update (main process: electron/updater.ts)
  checkForUpdates: (manual = false) => ipcRenderer.invoke('update:check', { manual }),
  downloadUpdate: () => ipcRenderer.invoke('update:download'),
  pauseUpdate: () => ipcRenderer.invoke('update:pause'),
  resumeUpdate: () => ipcRenderer.invoke('update:resume'),
  cancelUpdate: () => ipcRenderer.invoke('update:cancel'),
  quitAndInstall: () => ipcRenderer.invoke('update:quitAndInstall'),
  getUpdateState: () => ipcRenderer.invoke('update:getState'),
  getReleaseNotes: (tag?: string) => ipcRenderer.invoke('update:getReleaseNotes', { tag }),
  getUpdateChannels: () => ipcRenderer.invoke('update:getChannels'),
  setUpdateChannel: (channel: string) => ipcRenderer.invoke('update:setChannel', { channel }),
  setTestVersion: (version: string) => ipcRenderer.invoke('update:setTestVersion', { version }),
  compareVersions: (a: string, b: string) => ipcRenderer.invoke('update:compareVersions', { a, b }),
  onUpdateStatus: (callback: (data: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data);
    ipcRenderer.on('update:status', handler);
    return () => ipcRenderer.removeListener('update:status', handler);
  },
});
