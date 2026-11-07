import electron from 'electron';
import fs from 'fs';
import path from 'path';
import { loadConfig, saveConfig } from '../config';
import { importUserBackground, isManagedBackgroundFile, isPathInside } from '../core/background-image';
import { backgroundResourceUrl } from '../resource-protocol';

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

  // 导入自选壁纸：复制到 userData → 按屏幕所需尺寸降采样落盘，
  // 返回【文件路径】（配置文件以路径存储，不再使用 BASE64 dataURL）
  ipcMain.handle('background:import', async (_event, payload: { srcPath: string; maxEdge?: number }) => {
    try {
      const result = importUserBackground(payload.srcPath, payload.maxEdge || 4096);
      return { success: true, data: result, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });

  // 把配置/Store 中的「壁纸值」解析为可显示的资源引用：
  // - data:/http(s):/file: 及 /、./ 相对 URL → 原样返回（本身可直接用于 CSS）；
  // - userData 内的受管壁纸文件路径 → koring-res:// 协议 URL（流式读取，全程无 base64 副本）；
  // - 其它（越权路径/不存在等）→ data:null，调用方回退默认背景。
  ipcMain.handle('background:resolve', async (_event, payload: { value?: string }) => {
    try {
      const value = typeof payload?.value === 'string' ? payload.value.trim() : '';
      if (!value) return { success: true, data: null, error: null };
      if (/^(data:|https?:|file:|\.\.\/|\/|\.\/)/i.test(value)) {
        return { success: true, data: { url: value, bytes: 0 }, error: null };
      }
      const userDataDir = electron.app.getPath('userData');
      if (!path.isAbsolute(value) || !isPathInside(userDataDir, value)) {
        return { success: true, data: null, error: null };
      }
      const fileName = path.basename(value);
      if (!isManagedBackgroundFile(fileName)) {
        return { success: true, data: null, error: null };
      }
      const stat = fs.statSync(value);
      if (!stat.isFile()) return { success: true, data: null, error: null };
      return {
        success: true,
        data: { url: backgroundResourceUrl(fileName), bytes: stat.size },
        error: null,
      };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });
}
