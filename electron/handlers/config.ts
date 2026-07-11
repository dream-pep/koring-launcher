import electron from 'electron';
const { ipcMain, app } = electron;
import * as fs from 'fs';
import * as path from 'path';
import { loadConfig, saveConfig, type AppConfig, configPath } from '../config';

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
