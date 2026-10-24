import electron from 'electron';
import { launchGame, diagnoseVersion } from '../core/launcher';
import { resolveGamePath } from '../core/paths';
import { getConfig, type AppConfig } from '../config';

const { ipcMain, app } = electron;

interface WinRef {
  mainWindow: electron.BrowserWindow | null;
}

/**
 * 游戏窗口就绪后按配置处理启动器窗口（afterLaunch）：
 * - close      启动后立即关闭启动器
 * - minimize   最小化到任务栏
 * - keep       保持不变
 * - hide       隐藏（游戏退出后手动恢复）
 * - hide-exit  隐藏，游戏退出后自动退出启动器
 * - hide-reopen 隐藏，游戏退出后重新显示启动器
 */
function applyAfterLaunch(config: AppConfig, win: WinRef): void {
  const mode = config.advanced?.afterLaunch ?? 'close';
  const main = win.mainWindow;
  if (!main) return;
  if (mode === 'close') {
    main.close();
  } else if (mode === 'minimize') {
    main.minimize();
  } else if (mode === 'hide' || mode === 'hide-exit' || mode === 'hide-reopen') {
    main.hide();
  }
  // 'keep' → 无操作
}

/** 游戏进程退出后的启动器处理（仅 hide-exit / hide-reopen 有额外行为） */
function applyGameExit(config: AppConfig, win: WinRef): void {
  const mode = config.advanced?.afterLaunch ?? 'close';
  if (mode === 'hide-exit') {
    app.quit();
  } else if (mode === 'hide-reopen') {
    const main = win.mainWindow;
    if (main && !main.isDestroyed()) {
      main.show();
      main.focus();
    }
  }
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
          // afterLaunch 副作用：窗口就绪后关闭/最小化/隐藏启动器；游戏退出后按模式恢复或退出
          if (event.event === 'window-ready') {
            applyAfterLaunch(config, win);
          } else if (event.event === 'exit') {
            applyGameExit(config, win);
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
