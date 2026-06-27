import electron from 'electron';
import { installMinecraft, installModLoader, getVersionList, getForgeVersions, getFabricVersions } from '../core/installer';

const { ipcMain } = electron;

interface WinRef {
  mainWindow: electron.BrowserWindow | null;
}

export function registerInstallHandlers(win: WinRef) {
  ipcMain.handle('install:version-list', async (_event, payload: { type?: string }) => {
    try {
      const data = await getVersionList(payload.type);
      return { success: true, data, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });

  ipcMain.handle('install:forge-version-list', async (_event, payload: { mcVersion?: string }) => {
    try {
      const data = await getForgeVersions(payload.mcVersion);
      return { success: true, data, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });

  ipcMain.handle('install:fabric-version-list', async (_event, payload: { mcVersion?: string }) => {
    try {
      const data = await getFabricVersions(payload.mcVersion);
      return { success: true, data, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });

  ipcMain.handle('install:minecraft', async (_event, payload: {
    version: string;
    gamePath: string;
    javaPath?: string;
    downloadThreads?: number;
  }) => {
    try {
      const requestId = `install-mc-${Date.now()}`;

      installMinecraft(payload.version, payload.gamePath, payload.javaPath, payload.downloadThreads, {
        onProgress: (progress) => {
          win.mainWindow?.webContents.send('install:progress', { requestId, ...progress });
        },
      }).then((result) => {
        win.mainWindow?.webContents.send('install:complete', { requestId, ...result });
      }).catch((err) => {
        win.mainWindow?.webContents.send('install:error', { requestId, error: String(err) });
      });

      return { success: true, data: { requestId }, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });

  ipcMain.handle('install:mod-loader', async (_event, payload: {
    mcVersion: string;
    gamePath: string;
    loaderType: string;
    loaderVersion?: string;
    javaPath?: string;
  }) => {
    try {
      const requestId = `install-loader-${Date.now()}`;

      installModLoader(payload.mcVersion, payload.gamePath, payload.loaderType as 'forge' | 'fabric' | 'quilt' | 'neoforge', payload.loaderVersion, payload.javaPath, {
        onProgress: (progress) => {
          win.mainWindow?.webContents.send('install:progress', { requestId, ...progress });
        },
      }).then((result) => {
        win.mainWindow?.webContents.send('install:complete', { requestId, ...result });
      }).catch((err) => {
        win.mainWindow?.webContents.send('install:error', { requestId, error: String(err) });
      });

      return { success: true, data: { requestId }, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });
}
