import electron from 'electron';
const { ipcMain } = electron;
import { loadConfig, saveConfig, type AppConfig } from '../config';

export function registerConfigHandlers() {
  ipcMain.handle('config:get', () => {
    try {
      const config = loadConfig();
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
}
