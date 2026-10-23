import electron from 'electron';
import {
  createInstance,
  listInstances,
  getInstanceInfo,
  deleteInstance,
  updateInstance,
  installInstanceGame,
  repairInstance,
  diagnoseInstance,
  getMinecraftVersionList,
  getForgeVersionList,
  getFabricVersionList,
  getQuiltVersionList,
  importExistingInstance,
  inspectVersionLoaders,
  planInstanceLaunch,
  scanGameDirectories,
  readInstanceIcon,
  setInstanceIcon,
  clearInstanceIcon,
  type ImportMode,
  type InstanceRuntime,
  type InstanceConfig,
} from '../core/instance';
import { discoverGameFolders, inspectGameFolder, normalizeGameFolder } from '../core/game-folder';
import type { DownloadSettings } from '../core/download-options';
import { resolveGamePath } from '../core/paths';

const { ipcMain } = electron;

interface WinRef {
  mainWindow: electron.BrowserWindow | null;
}

function ok(data: unknown) {
  return { success: true, data, error: null };
}

function fail(e: unknown) {
  return { success: false, data: null, error: e instanceof Error ? e.message : String(e) };
}

export function registerInstanceHandlers(win: WinRef) {
  /**
   * 安装 / 修复共用：立刻返回 requestId，进度与结果通过事件通道推送给渲染端。
   * 事件：instance:progress → instance:install-complete / instance:install-error
   */
  function runAsyncInstall(
    channel: 'install' | 'repair',
    task: (onProgress: (progress: unknown) => void) => Promise<unknown>
  ) {
    const requestId = `${channel}-${Date.now()}`;
    win.mainWindow?.webContents.send(`instance:${channel}-start`, { requestId });
    task((progress) => {
      win.mainWindow?.webContents.send('instance:progress', { requestId, channel, ...(progress as object) });
    })
      .then((data) => {
        win.mainWindow?.webContents.send('instance:install-complete', { requestId, channel, data });
      })
      .catch((err) => {
        win.mainWindow?.webContents.send('instance:install-error', {
          requestId,
          channel,
          error: err instanceof Error ? err.message : String(err),
        });
      });
    return { requestId };
  }

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
    launchVersion?: string;
    resourcePath?: string;
    importMode?: ImportMode;
  }) => {
    try {
      const data = await createInstance(payload.name, resolveGamePath(payload.gamePath), payload.runtime, {
        author: payload.author,
        description: payload.description,
        java: payload.java,
        minMemory: payload.minMemory,
        maxMemory: payload.maxMemory,
        vmOptions: payload.vmOptions,
        mcOptions: payload.mcOptions,
        launchVersion: payload.launchVersion,
        resourcePath: payload.resourcePath ? resolveGamePath(payload.resourcePath) : undefined,
        importMode: payload.importMode,
      });
      return ok(data);
    } catch (e: unknown) {
      return fail(e);
    }
  });

  ipcMain.handle('instance:list', async (_event, payload: { gamePath: string }) => {
    try {
      return ok(await listInstances(resolveGamePath(payload.gamePath)));
    } catch (e: unknown) {
      return fail(e);
    }
  });

  ipcMain.handle('instance:info', async (_event, payload: { name: string; gamePath: string }) => {
    try {
      return ok(await getInstanceInfo(payload.name, resolveGamePath(payload.gamePath)));
    } catch (e: unknown) {
      return fail(e);
    }
  });

  ipcMain.handle('instance:delete', async (_event, payload: { name: string; gamePath: string }) => {
    try {
      return ok(await deleteInstance(payload.name, resolveGamePath(payload.gamePath)));
    } catch (e: unknown) {
      return fail(e);
    }
  });

  ipcMain.handle('instance:update', async (_event, payload: {
    name: string;
    gamePath: string;
    patch: Partial<Omit<InstanceConfig, 'name' | 'creationDate'>>;
  }) => {
    try {
      const patch = { ...payload.patch };
      if (patch.resourcePath) patch.resourcePath = resolveGamePath(patch.resourcePath);
      return ok(updateInstance(payload.name, resolveGamePath(payload.gamePath), patch));
    } catch (e: unknown) {
      return fail(e);
    }
  });

  // 图标：读 / 设 / 清（图标文件放在实例目录，logo.png 优先）
  ipcMain.handle('instance:icon', async (_event, payload: { name: string; gamePath: string }) => {
    try {
      return ok(readInstanceIcon(payload.name, resolveGamePath(payload.gamePath)));
    } catch (e: unknown) {
      return fail(e);
    }
  });

  ipcMain.handle('instance:set-icon', async (_event, payload: {
    name: string;
    gamePath: string;
    sourcePath: string;
  }) => {
    try {
      return ok(setInstanceIcon(payload.name, resolveGamePath(payload.gamePath), payload.sourcePath));
    } catch (e: unknown) {
      return fail(e);
    }
  });

  ipcMain.handle('instance:reset-icon', async (_event, payload: { name: string; gamePath: string }) => {
    try {
      return ok(clearInstanceIcon(payload.name, resolveGamePath(payload.gamePath)));
    } catch (e: unknown) {
      return fail(e);
    }
  });

  // 安装：首次安装（原版 + 加载器 + 依赖）
  ipcMain.handle('instance:install', async (_event, payload: {
    name: string;
    gamePath: string;
    download?: DownloadSettings;
  }) => {
    try {
      const gamePath = resolveGamePath(payload.gamePath);
      const data = runAsyncInstall('install', (onProgress) =>
        installInstanceGame(payload.name, gamePath, { onProgress }, payload.download)
      );
      return ok(data);
    } catch (e: unknown) {
      return fail(e);
    }
  });

  // 修复：按缺失内容补齐版本 / 加载器 / 依赖库
  ipcMain.handle('instance:repair', async (_event, payload: {
    name: string;
    gamePath: string;
    download?: DownloadSettings;
  }) => {
    try {
      const gamePath = resolveGamePath(payload.gamePath);
      const data = runAsyncInstall('repair', (onProgress) =>
        repairInstance(payload.name, gamePath, { onProgress }, payload.download)
      );
      return ok(data);
    } catch (e: unknown) {
      return fail(e);
    }
  });

  ipcMain.handle('instance:diagnose', async (_event, payload: { name: string; gamePath: string }) => {
    try {
      return ok(await diagnoseInstance(payload.name, resolveGamePath(payload.gamePath)));
    } catch (e: unknown) {
      return fail(e);
    }
  });

  /**
   * 启动环境体检（不抛错）：返回实际启动版本、资源根、游戏根与依赖状态。
   * 供实例详情页展示「启动将使用 xxx」与一键修复入口。
   */
  ipcMain.handle('instance:launch-info', async (_event, payload: { name: string; gamePath: string }) => {
    try {
      const { instance, plan } = planInstanceLaunch(payload.name, resolveGamePath(payload.gamePath));
      return ok({ launch: instance.launch, dependency: instance.dependency, plan });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const code = (e as { code?: string })?.code ?? 'UNKNOWN';
      return ok({ launch: null, dependency: null, plan: null, problem: { code, message } });
    }
  });

  // 版本列表 APIs
  ipcMain.handle('instance:version-list', async (_event, payload: { type?: string }) => {
    try {
      return ok(await getMinecraftVersionList(payload?.type));
    } catch (e: unknown) {
      return fail(e);
    }
  });

  ipcMain.handle('instance:forge-version-list', async (_event, payload: { mcVersion?: string }) => {
    try {
      return ok(await getForgeVersionList(payload?.mcVersion));
    } catch (e: unknown) {
      return fail(e);
    }
  });

  ipcMain.handle('instance:fabric-version-list', async (_event, payload: { mcVersion?: string }) => {
    try {
      return ok(await getFabricVersionList(payload?.mcVersion));
    } catch (e: unknown) {
      return fail(e);
    }
  });

  ipcMain.handle('instance:quilt-version-list', async (_event, payload: { mcVersion?: string }) => {
    try {
      return ok(await getQuiltVersionList(payload?.mcVersion));
    } catch (e: unknown) {
      return fail(e);
    }
  });

  // 读取某个版本 JSON 中实际声明的加载器
  ipcMain.handle('instance:version-loaders', async (_event, payload: { gamePath: string; versionId: string }) => {
    try {
      return ok(inspectVersionLoaders(resolveGamePath(payload.gamePath), payload.versionId));
    } catch (e: unknown) {
      return fail(e);
    }
  });

  // 扫描游戏目录中的已安装版本
  ipcMain.handle('instance:scan-dir', async (_event, payload: { gamePath: string }) => {
    try {
      const gamePath = resolveGamePath(payload.gamePath);
      return ok({ versions: scanGameDirectories(gamePath), folder: inspectGameFolder(gamePath) });
    } catch (e: unknown) {
      return fail(e);
    }
  });

  // 识别用户选择的任意目录（.minecraft / versions / 版本目录 / 实例目录）
  ipcMain.handle('instance:inspect-dir', async (_event, payload: { folderPath: string }) => {
    try {
      const folderPath = resolveGamePath(payload.folderPath);
      const normalized = normalizeGameFolder(folderPath);
      const info = inspectGameFolder(folderPath);
      return ok({ normalized, info });
    } catch (e: unknown) {
      return fail(e);
    }
  });

  // 自动搜索本机常见位置的游戏目录
  ipcMain.handle('instance:discover-dirs', async (_event, payload: { extraPaths?: string[] } = {}) => {
    try {
      const extraPaths = (payload?.extraPaths ?? []).map((item) => resolveGamePath(item));
      return ok(discoverGameFolders(extraPaths));
    } catch (e: unknown) {
      return fail(e);
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
    /** reference：保留在原目录引用启动；copy：复制版本文件并链接共享 libraries/assets */
    mode?: ImportMode;
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
          mode: payload.mode,
        }
      );
      return ok(data);
    } catch (e: unknown) {
      return fail(e);
    }
  });
}
