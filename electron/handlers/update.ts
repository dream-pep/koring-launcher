import electron from 'electron';
import { updateService } from '../updater';

const { ipcMain } = electron;

/**
 * 更新 IPC handler。
 * - 主进程更新服务初始化后，状态变化广播到所有窗口（update:status）
 * - 渲染进程通过 update:check / update:download / update:quitAndInstall / update:getState 交互
 */
export function registerUpdateHandlers() {
  updateService.init((payload) => {
    for (const win of electron.BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('update:status', payload);
      }
    }
  });

  ipcMain.handle('update:check', async (_event, payload?: { manual?: boolean }) => {
    try {
      const state = await updateService.check(payload?.manual === true);
      return { success: true, data: state, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });

  ipcMain.handle('update:download', async () => {
    try {
      await updateService.download();
      return { success: true, data: null, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });

  ipcMain.handle('update:pause', () => {
    try {
      updateService.pause();
      return { success: true, data: null, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });

  ipcMain.handle('update:resume', async () => {
    try {
      await updateService.download(); // paused → download() 即继续
      return { success: true, data: null, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });

  ipcMain.handle('update:cancel', () => {
    try {
      updateService.cancel();
      return { success: true, data: null, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });

  ipcMain.handle('update:quitAndInstall', () => {
    try {
      updateService.quitAndInstall();
      return { success: true, data: null, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });

  ipcMain.handle('update:getState', () => {
    try {
      return { success: true, data: updateService.getState(), error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });

  // 读取发布说明（release-notes.md 附件，原始 Markdown；GitHub 优先 + 加速源兜底）
  ipcMain.handle('update:getReleaseNotes', async (_event, payload?: { tag?: string }) => {
    try {
      const data = await updateService.getReleaseNotes(payload?.tag);
      return { success: true, data, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });
}
