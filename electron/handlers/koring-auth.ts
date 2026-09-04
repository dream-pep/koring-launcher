import electron from 'electron';
const { ipcMain } = electron;
import {
  requestDeviceCode,
  pollForTokenOnce,
  refreshAccessToken,
  saveKoringAuth,
  readKoringAuth,
  deleteKoringAuth,
} from '../core/koring-auth';
import { getConfig, updateConfig, deleteConfigKey } from '../config';
import { createLogger } from '../core/logger';

const log = createLogger('koring-auth');

export function registerKoringAuthHandlers() {
  ipcMain.handle('koring-auth:request-device-code', async () => {
    try {
      const result = await requestDeviceCode();
      return { success: true, data: result, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });

  ipcMain.handle('koring-auth:poll-token', async (_event, deviceCode: string) => {
    try {
      const result = await pollForTokenOnce(deviceCode);
      const user = saveKoringAuth(result);

      // 同步到配置文件（主进程权威模型：合并内存缓存 + debounce 写盘）
      try {
        updateConfig({
          koringUser: {
            sub: user.sub,
            name: user.name,
            username: user.username,
            email: user.email,
            picture: user.picture,
            accessToken: result.access_token,
            refreshToken: result.refresh_token,
          },
        });
      } catch (e) {
        log.error('[koring-auth] failed to save user to config:', e);
      }

      return { success: true, data: { user }, error: null };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { success: false, data: null, error: msg };
    }
  });

  ipcMain.handle('koring-auth:refresh', async () => {
    try {
      const stored = readKoringAuth();
      if (!stored?.refresh_token) throw new Error('No refresh token');
      const result = await refreshAccessToken(stored.refresh_token);
      const user = saveKoringAuth(result);

      // 同步到配置文件
      try {
        updateConfig({
          koringUser: {
            sub: user.sub,
            name: user.name,
            username: user.username,
            email: user.email,
            picture: user.picture,
            accessToken: result.access_token,
            refreshToken: result.refresh_token,
          },
        });
      } catch {}

      return { success: true, data: { user }, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });

  ipcMain.handle('koring-auth:get-user', () => {
    try {
      const stored = readKoringAuth();
      // 也从配置文件读取（内存权威）
      if (!stored?.user?.sub) {
        try {
          const config = getConfig();
          const ku = (config as any).koringUser;
          if (ku?.sub) {
            return { success: true, data: { user: ku, access_token: '', refresh_token: '', id_token: '', expires_at: 0 }, error: null };
          }
        } catch {}
      }
      return { success: true, data: stored, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });

  ipcMain.handle('koring-auth:logout', () => {
    try {
      deleteKoringAuth();
      // 清除配置文件中的用户数据
      try {
        deleteConfigKey('koringUser');
      } catch {}
      return { success: true, data: null, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });
}
