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
    return getFileAsDataUrl(destPath);
  },

  // Get cached background as base64 data URL
  getBackgroundDataUrl: async (): Promise<string | null> => {
    const filePath = await ipcRenderer.invoke('background:getCachedPath');
    if (!filePath) return null;
    return getFileAsDataUrl(filePath);
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
  onUpdateStatus: (callback: (data: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data);
    ipcRenderer.on('update:status', handler);
    return () => ipcRenderer.removeListener('update:status', handler);
  },
});
