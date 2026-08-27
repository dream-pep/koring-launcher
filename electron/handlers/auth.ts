import electron from 'electron';
const { ipcMain } = electron;
import { readAuth, writeAuth, deleteAuth } from '../auth';
import { offlineLogin } from '../core/auth';

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

  // 离线账号登录（离线模式不需要微软 OAuth，用户名即可生成 UUID）
  ipcMain.handle('auth:offline-login', async (_event, payload: { username: string }) => {
    try {
      const username = (payload?.username || '').trim();
      if (!username) {
        return { success: false, data: null, error: '用户名不能为空' };
      }
      if (username.length > 16) {
        return { success: false, data: null, error: '用户名长度不能超过 16 个字符' };
      }
      const data = await offlineLogin(username);
      return { success: true, data, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });
}
