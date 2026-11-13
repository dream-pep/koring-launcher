import electron from 'electron';
const { ipcMain } = electron;
import { scanStorage, type StorageReport } from '../core/storage';

interface WinRef {
  mainWindow: electron.BrowserWindow | null;
}

export function registerStorageHandlers(win: WinRef) {
  // 并发去重：页面 keep-alive / React StrictMode 双触发时共享同一个进行中的扫描
  let inflight: Promise<StorageReport> | null = null;

  ipcMain.handle('storage:scan', async () => {
    if (inflight) {
      try {
        return { success: true, data: await inflight, error: null };
      } catch (e: unknown) {
        return { success: false, data: null, error: String(e) };
      }
    }

    inflight = scanStorage((progress) => {
      win.mainWindow?.webContents.send('storage:progress', progress);
    });
    try {
      const data = await inflight;
      return { success: true, data, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    } finally {
      inflight = null;
    }
  });
}
