import electron from 'electron';
const { ipcMain, app } = electron;
import * as fs from 'fs';
import { getConfig, saveConfig, updateConfig, type AppConfig, configPath } from '../config';

interface WinRef {
  mainWindow: electron.BrowserWindow | null;
}

export function registerConfigHandlers(win: WinRef) {
  ipcMain.handle('config:get', () => {
    try {
      const config = getConfig();
      return { success: true, data: config, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });

  ipcMain.handle('config:save', (_event, config: AppConfig) => {
    try {
      saveConfig(config);
      return { success: true, data: null, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });

  // 广播防抖：输入框/滑块每键触发 update 时，不立刻全树广播（避免整页重渲染打断交互），
  // 合并到 250ms 后只广播一次最新配置；渲染端乐观更新保证即时反馈。
  let broadcastTimer: ReturnType<typeof setTimeout> | null = null;
  const scheduleBroadcast = () => {
    if (broadcastTimer) clearTimeout(broadcastTimer);
    broadcastTimer = setTimeout(() => {
      broadcastTimer = null;
      if (win.mainWindow && !win.mainWindow.isDestroyed()) {
        win.mainWindow.webContents.send('config:changed', getConfig());
      }
    }, 250);
  };

  // 主进程权威更新：渲染进程提交 { section, patch } 补丁，
  // 主进程深度合并到内存配置 → debounce 稀疏写盘 → 防抖广播完整配置给所有渲染进程
  ipcMain.handle('config:update', (_event, payload: { section: string; patch: unknown }) => {
    try {
      const { section, patch } = payload;
      const config = updateConfig({ [section]: patch } as Record<string, unknown>);
      scheduleBroadcast();
      return { success: true, data: config, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });

  ipcMain.handle('config:reset', () => {
    try {
      const filePath = configPath();
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      app.relaunch();
      app.exit(0);
      return { success: true, data: null, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });
}
