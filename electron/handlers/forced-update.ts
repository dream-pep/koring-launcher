import electron from 'electron';
import { forcedUpdateService } from '../core/forced-update';

const { ipcMain } = electron;

/**
 * 强制升级（强下载版本页面）IPC handler。
 * - 状态变化广播到所有窗口（forced-update:status），渲染端驱动大圆环进度
 * - forced-update:prepare 进入页面时调用（解析目标版本 + 检查本地已有安装包 + 开始下载）
 * - forced-update:install 点击「立即安装」（不校验，直接静默安装；dev 下仅重启）
 */
export function registerForcedUpdateHandlers() {
  forcedUpdateService.init((status) => {
    for (const win of electron.BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('forced-update:status', status);
      }
    }
  });

  ipcMain.handle('forced-update:prepare', async (_event, payload?: { targetVersion?: string }) => {
    try {
      const data = await forcedUpdateService.prepare(payload?.targetVersion);
      return { success: true, data, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });

  ipcMain.handle('forced-update:install', async () => {
    try {
      const data = await forcedUpdateService.install();
      return { success: true, data, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });

  ipcMain.handle('forced-update:getState', () => {
    try {
      return { success: true, data: forcedUpdateService.getStatus(), error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });
}
