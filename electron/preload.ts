import electron from 'electron';
import path from 'path';
import fs from 'fs';
const { contextBridge, ipcRenderer } = electron;

const MIME_MAP: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
};

function getFileAsDataUrl(filePath: string): string | null {
  try {
    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME_MAP[ext] || 'image/png';
    return `data:${mime};base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  }
}

// 按当前窗口实际像素需求计算背景图长边上限（含高分屏余量），
// 避免把数 MB～数十 MB 原图原样塞进渲染进程。
function computeMaxEdge(): number {
  const dpr = window.devicePixelRatio || 1;
  const css = Math.max(window.innerWidth || 1280, window.innerHeight || 800);
  const target = Math.round(Math.max(css, 1920) * dpr * 1.1);
  return Math.min(4096, Math.max(1920, target));
}

// 经主进程降采样/重编码后返回 data URL；主进程无法处理时回退到原始文件（行为不变）。
async function prepareBackgroundDataUrl(filePath: string): Promise<string | null> {
  try {
    const result = (await ipcRenderer.invoke('background:prepare', {
      srcPath: filePath,
      maxEdge: computeMaxEdge(),
    })) as { success?: boolean; data?: { dataUrl?: string | null } | null };
    if (result?.success && typeof result.data?.dataUrl === 'string' && result.data.dataUrl.length > 0) {
      return result.data.dataUrl;
    }
  } catch {
    // fallthrough to raw
  }
  return getFileAsDataUrl(filePath);
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

  // Background image — pick file, copy to userData, return base64 data URL
  pickBackgroundImage: async (): Promise<string | null> => {
    const result = await ipcRenderer.invoke('dialog:openFile', {
      filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] }],
    });
    if (!result) return null;
    const { srcPath, ext } = result as { srcPath: string; ext: string };
    // Copy to userData via main process
    const destPath = await ipcRenderer.invoke('background:copyToUserData', srcPath, ext);
    if (!destPath) return null;
    return prepareBackgroundDataUrl(destPath);
  },

  // Get cached background as base64 data URL（自动降采样到屏幕所需尺寸）
  getBackgroundDataUrl: async (): Promise<string | null> => {
    const filePath = await ipcRenderer.invoke('background:getCachedPath');
    if (!filePath) return null;
    return prepareBackgroundDataUrl(filePath);
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
