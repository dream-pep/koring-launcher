import electron from 'electron';
import {
  createInstance,
  listInstances,
  getInstanceInfo,
  deleteInstance,
  updateInstance,
  installInstanceGame,
  launchInstance,
  diagnoseInstance,
  getMinecraftVersionList,
  getForgeVersionList,
  getFabricVersionList,
  getQuiltVersionList,
  scanGameDirectories,
  type InstanceRuntime,
  type InstanceConfig,
} from '../core/instance';

const { ipcMain } = electron;

interface WinRef {
  mainWindow: electron.BrowserWindow | null;
}

export function registerInstanceHandlers(win: WinRef) {
  ipcMain.handle('instance:create', async (_event, payload: {
    name: string;
    gamePath: string;
    runtime: InstanceRuntime;
    author?: string;
    description?: string;
    java?: string;
    minMemory?: number;
    maxMemory?: number;
    vmOptions?: string[];
    mcOptions?: string[];
  }) => {
    try {
      const data = await createInstance(
        payload.name,
        payload.gamePath,
        payload.runtime,
        {
          author: payload.author,
          description: payload.description,
          java: payload.java,
          minMemory: payload.minMemory,
          maxMemory: payload.maxMemory,
          vmOptions: payload.vmOptions,
          mcOptions: payload.mcOptions,
        }
      );
      return { success: true, data, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });

  ipcMain.handle('instance:list', async (_event, payload: { gamePath: string }) => {
    try {
      const data = await listInstances(payload.gamePath);
      return { success: true, data, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });

  ipcMain.handle('instance:info', async (_event, payload: { name: string; gamePath: string }) => {
    try {
      const data = await getInstanceInfo(payload.name, payload.gamePath);
      return { success: true, data, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });

  ipcMain.handle('instance:delete', async (_event, payload: { name: string; gamePath: string }) => {
    try {
      const data = await deleteInstance(payload.name, payload.gamePath);
      return { success: true, data, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });

  ipcMain.handle('instance:update', async (_event, payload: {
    name: string;
    gamePath: string;
    patch: Partial<Omit<InstanceConfig, 'name' | 'creationDate'>>;
  }) => {
    try {
      const data = await updateInstance(payload.name, payload.gamePath, payload.patch);
      return { success: true, data, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });

  ipcMain.handle('instance:install', async (_event, payload: { name: string; gamePath: string }) => {
    try {
      const requestId = `install-${Date.now()}`;

      installInstanceGame(payload.name, payload.gamePath, {
        onProgress: (progress) => {
          win.mainWindow?.webContents.send('instance:progress', { requestId, ...progress });
        },
      }).then((data) => {
        win.mainWindow?.webContents.send('instance:install-complete', { requestId, data });
      }).catch((err) => {
        win.mainWindow?.webContents.send('instance:install-error', { requestId, error: String(err) });
      });

      return { success: true, data: { requestId }, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });

  ipcMain.handle('instance:launch', async (_event, payload: {
    name: string;
    gamePath: string;
    username: string;
    uuid: string;
    accessToken?: string;
    javaPath?: string;
    server?: { host: string; port?: number };
  }) => {
    try {
      const requestId = `launch-${Date.now()}`;

      launchInstance(payload.name, payload.gamePath, {
        username: payload.username,
        uuid: payload.uuid,
        accessToken: payload.accessToken,
        javaPath: payload.javaPath,
        server: payload.server,
        onEvent: (event) => {
          win.mainWindow?.webContents.send('instance:launch-event', { requestId, ...event });
        },
      }).then((data) => {
        win.mainWindow?.webContents.send('instance:launch-complete', { requestId, data });
      }).catch((err) => {
        win.mainWindow?.webContents.send('instance:launch-error', { requestId, error: String(err) });
      });

      return { success: true, data: { requestId }, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });

  ipcMain.handle('instance:diagnose', async (_event, payload: { name: string; gamePath: string }) => {
    try {
      const data = await diagnoseInstance(payload.name, payload.gamePath);
      return { success: true, data, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });

  // Version list APIs
  ipcMain.handle('instance:version-list', async (_event, payload: { type?: string }) => {
    try {
      const data = await getMinecraftVersionList(payload.type);
      return { success: true, data, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });

  ipcMain.handle('instance:forge-version-list', async (_event, payload: { mcVersion?: string }) => {
    try {
      const data = await getForgeVersionList(payload.mcVersion);
      return { success: true, data, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });

  ipcMain.handle('instance:fabric-version-list', async (_event, payload: { mcVersion?: string }) => {
    try {
      const data = await getFabricVersionList(payload.mcVersion);
      return { success: true, data, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });

  ipcMain.handle('instance:quilt-version-list', async (_event, payload: { mcVersion?: string }) => {
    try {
      const data = await getQuiltVersionList(payload.mcVersion);
      return { success: true, data, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });

  // 扫描游戏目录中的已安装版本
  ipcMain.handle('instance:scan-dir', async (_event, payload: { gamePath: string }) => {
    try {
      const versions = scanGameDirectories(payload.gamePath);
      return { success: true, data: { versions }, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });
}
