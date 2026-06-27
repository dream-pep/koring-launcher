import electron from 'electron';
import { launchMinecraft, diagnoseVersion } from '../core/launcher';

const { ipcMain } = electron;

interface WinRef {
  mainWindow: electron.BrowserWindow | null;
}

export function registerLaunchHandlers(win: WinRef) {
  ipcMain.handle('launch:launch', async (_event, payload: {
    gamePath: string;
    javaPath: string;
    version: string;
    username: string;
    uuid: string;
    accessToken?: string;
    memory?: { min?: string; max?: string };
    jvmArgs?: string[];
    gameArgs?: string[];
    server?: { ip: string; port?: number };
    detached?: boolean;
  }) => {
    try {
      const requestId = `launch-${Date.now()}`;

      const result = await launchMinecraft({
        gamePath: payload.gamePath,
        javaPath: payload.javaPath,
        version: payload.version,
        username: payload.username,
        uuid: payload.uuid,
        accessToken: payload.accessToken,
        memory: payload.memory,
        jvmArgs: payload.jvmArgs,
        gameArgs: payload.gameArgs,
        server: payload.server,
        detached: payload.detached,
        onEvent: (event) => {
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
