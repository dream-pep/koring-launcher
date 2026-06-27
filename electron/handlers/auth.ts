import electron from 'electron';
const { ipcMain } = electron;
import { readAuth, writeAuth, deleteAuth } from '../auth';

export function registerAuthHandlers() {
  ipcMain.handle('auth:get', () => {
    try {
      const auth = readAuth();
      return { success: true, data: auth, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });

  ipcMain.handle('auth:save', (_event, auth) => {
    try {
      writeAuth(auth);
      return { success: true, data: null, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });

  ipcMain.handle('auth:delete', () => {
    try {
      deleteAuth();
      return { success: true, data: null, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });
}
