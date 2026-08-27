import electron from 'electron';
import { launchGame, diagnoseVersion } from '../core/launcher';
import { resolveGamePath } from '../core/paths';
import { getConfig, type AppConfig } from '../config';

const { ipcMain } = electron;

interface WinRef {
  mainWindow: electron.BrowserWindow | null;
}

// 游戏窗口就绪后按配置处理启动器窗口（afterLaunch）
function applyAfterLaunch(config: AppConfig, win: WinRef): void {
  const mode = config.advanced?.afterLaunch ?? 'close';
  if (mode === 'close') {
    win.mainWindow?.close();
  } else if (mode === 'minimize') {
    win.mainWindow?.minimize();
  }
  // 'keep' → 无操作
}

export function registerLaunchHandlers(win: WinRef) {
  ipcMain.handle('launch:launch', async (_event, payload: {
    instanceName: string;
    gamePath: string;
    profile: { username: string; uuid: string; accessToken?: string };
    server?: { ip: string; port?: number };
  }) => {
    try {
      const requestId = `launch-${Date.now()}`;

      // 使用主进程内存配置（唯一权威，永远是最新值，无磁盘竞争）
      const config = getConfig();

      // 快速进入服务器：UI 显式传入优先，否则使用配置中保存的 advanced.server
      const server = payload.server
        ?? (config.advanced?.server?.ip ? config.advanced.server : undefined);

      const result = await launchGame({
        config,
        instanceName: payload.instanceName,
        gamePath: resolveGamePath(payload.gamePath),
        profile: payload.profile,
        server,
        onEvent: (event) => {
          // afterLaunch 副作用：窗口就绪后关闭/最小化启动器
          if (event.event === 'window-ready') {
            applyAfterLaunch(config, win);
          }
          win.mainWindow?.webContents.send('launch:event', { requestId, ...event });
        },
      });

      return { success: true, data: { ...result, requestId }, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });

  ipcMain.handle('launch:diagnose', async (_event, payload: { gamePath: string; version: string }) => {
    try {
      const data = await diagnoseVersion(payload.gamePath, payload.version);
      return { success: true, data, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });
}
