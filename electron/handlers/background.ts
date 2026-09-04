import electron from 'electron';
import fs from 'fs';
import path from 'path';
import { loadConfig, saveConfig } from '../config';
import { prepareBackgroundImage } from '../core/background-image';

const { ipcMain } = electron;

export function registerBackgroundHandlers() {
  ipcMain.handle('background:set-image', async (_event, payload: { url: string; blur?: number; opacity?: number }) => {
    try {
      const config = loadConfig();
      config.background.bgType = 'image';
      config.background.image = payload.url;
      if (payload.blur !== undefined) config.background.blur = payload.blur;
      if (payload.opacity !== undefined) config.background.opacity = payload.opacity;
      saveConfig(config);
      return { success: true, data: config.background, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });

  ipcMain.handle('background:set-color', async (_event, payload: { color: string }) => {
    try {
      const config = loadConfig();
      config.background.bgType = 'color';
      config.background.image = payload.color;
      saveConfig(config);
      return { success: true, data: config.background, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });

  ipcMain.handle('background:set-blur', async (_event, payload: { blur: number }) => {
    try {
      const config = loadConfig();
      config.background.blur = payload.blur;
      saveConfig(config);
      return { success: true, data: config.background, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });

  ipcMain.handle('background:set-opacity', async (_event, payload: { opacity: number }) => {
    try {
      const config = loadConfig();
      config.background.opacity = payload.opacity;
      saveConfig(config);
      return { success: true, data: config.background, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });

  ipcMain.handle('background:set-animation', async (_event, payload: { type: string; speed?: number }) => {
    try {
      // Animation config is not persisted in current design, return defaults
      return { success: true, data: { bgType: 'image', image: '/background.png', blur: 0, opacity: 100 }, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });

  ipcMain.handle('background:get', async () => {
    try {
      const config = loadConfig();
      return { success: true, data: config.background, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });

  ipcMain.handle('background:set-theme', async (_event, payload: { theme: string }) => {
    try {
      const config = loadConfig();
      config.theme.darkMode = payload.theme;
      saveConfig(config);
      return { success: true, data: config.background, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });

  ipcMain.handle('background:reset', async () => {
    try {
      const config = loadConfig();
      config.background = { bgType: 'image', image: '/background.png', blur: 0, opacity: 100 };
      saveConfig(config);
      return { success: true, data: config.background, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });

  // Copy file to userData and return the destination path
  ipcMain.handle('background:copyToUserData', async (_event, srcPath: string, ext: string) => {
    try {
      const userDataPath = electron.app.getPath('userData');
      const destPath = path.join(userDataPath, `background-custom${ext}`);
      fs.copyFileSync(srcPath, destPath);
      return destPath;
    } catch {
      return null;
    }
  });

  // Get cached background file path from userData
  ipcMain.handle('background:getCachedPath', async () => {
    try {
      const userDataPath = electron.app.getPath('userData');
      const files = fs.readdirSync(userDataPath).filter(f => f.startsWith('background-custom'));
      if (files.length === 0) return null;
      return path.join(userDataPath, files[0]);
    } catch {
      return null;
    }
  });

  // 背景图降采样/重编码（程序本体资源管理）：把大图在进渲染进程前压到屏幕所需尺寸
  ipcMain.handle('background:prepare', async (_event, payload: { srcPath: string; maxEdge?: number }) => {
    try {
      const result = prepareBackgroundImage(payload.srcPath, payload.maxEdge || 4096);
      return { success: true, data: result, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });
}
