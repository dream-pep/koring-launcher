import electron from 'electron';
import {
  createInstance,
  listInstances,
  getInstanceInfo,
  deleteInstance,
  updateInstance,
  installInstanceGame,
  diagnoseInstance,
  getMinecraftVersionList,
  getForgeVersionList,
  getFabricVersionList,
  getQuiltVersionList,
  scanGameDirectories,
  importExistingInstance,
  type InstanceRuntime,
  type InstanceConfig,
} from '../core/instance';
import { resolveGamePath } from '../core/paths';

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
      const gamePath = resolveGamePath(payload.gamePath);
      const data = await createInstance(
        payload.name,
        gamePath,
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
      const data = await listInstances(resolveGamePath(payload.gamePath));
      return { success: true, data, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });

  ipcMain.handle('instance:info', async (_event, payload: { name: string; gamePath: string }) => {
    try {
      const data = await getInstanceInfo(payload.name, resolveGamePath(payload.gamePath));
      return { success: true, data, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });

  ipcMain.handle('instance:delete', async (_event, payload: { name: string; gamePath: string }) => {
    try {
      const data = await deleteInstance(payload.name, resolveGamePath(payload.gamePath));
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
      const data = await updateInstance(payload.name, resolveGamePath(payload.gamePath), payload.patch);
      return { success: true, data, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });

  ipcMain.handle('instance:install', async (_event, payload: { name: string; gamePath: string }) => {
    try {
      const requestId = `install-${Date.now()}`;
      const gamePath = resolveGamePath(payload.gamePath);

      installInstanceGame(payload.name, gamePath, {
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

  ipcMain.handle('instance:diagnose', async (_event, payload: { name: string; gamePath: string }) => {
    try {
      const data = await diagnoseInstance(payload.name, resolveGamePath(payload.gamePath));
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
      const versions = scanGameDirectories(resolveGamePath(payload.gamePath));
      return { success: true, data: { versions }, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });

  // 从已安装版本导入实例
  ipcMain.handle('instance:import', async (_event, payload: {
    name: string;
    gamePath: string;
    versionId: string;
    description?: string;
    java?: string;
    minMemory?: number;
    maxMemory?: number;
    /** 版本文件来源目录（扫描副目录导入时传扫描目录） */
    sourceGamePath?: string;
  }) => {
    try {
      const data = await importExistingInstance(
        payload.name,
        resolveGamePath(payload.gamePath),
        payload.versionId,
        {
          description: payload.description,
          java: payload.java,
          minMemory: payload.minMemory,
          maxMemory: payload.maxMemory,
          sourceGamePath: payload.sourceGamePath ? resolveGamePath(payload.sourceGamePath) : undefined,
        }
      );
      return { success: true, data, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });
}
