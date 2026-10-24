/**
 * 实例资产 IPC 注册（存档 / 截图 / 资源包）。
 *
 * 统一返回 `{ success, data, error }`，与其余 handler 保持一致；
 * 核心逻辑全部是「不抛错」的扫描/操作，这里仍包一层 try/catch 兜底，
 * 保证渲染端只会看到成功的空列表或明确的错误字符串。
 */

import electron from 'electron';
import {
  listInstanceSaves,
  deleteInstanceSaves,
  backupInstanceSaves,
  listInstanceScreenshots,
  deleteInstanceScreenshots,
  listInstanceResourcePacks,
} from '../core/instance-assets';

const { ipcMain } = electron;

function ok<T>(data: T) {
  return { success: true, data, error: null };
}

function fail(e: unknown) {
  return { success: false, data: null, error: e instanceof Error ? e.message : String(e) };
}

/** 从 payload 中取实例路径（缺省当空字符串，核心函数会按空处理） */
function readInstancePath(payload: { instancePath?: unknown } | null | undefined): string {
  const instancePath = payload?.instancePath;
  return typeof instancePath === 'string' ? instancePath : '';
}

/** 从 payload 中取名称数组（非数组按空处理） */
function readNameList(payload: { dirNames?: unknown; fileNames?: unknown } | null | undefined, key: 'dirNames' | 'fileNames'): string[] {
  const raw = payload?.[key];
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is string => typeof item === 'string');
}

export function registerInstanceAssetsHandlers(): void {
  // 存档列表
  ipcMain.handle('instance:saves-list', async (_event, payload: { instancePath?: string }) => {
    try {
      return ok(listInstanceSaves(readInstancePath(payload)));
    } catch (e: unknown) {
      return fail(e);
    }
  });

  // 删除存档（按目录名，basename 校验）
  ipcMain.handle('instance:saves-delete', async (_event, payload: {
    instancePath?: string;
    dirNames?: string[];
  }) => {
    try {
      return ok(deleteInstanceSaves(readInstancePath(payload), readNameList(payload, 'dirNames')));
    } catch (e: unknown) {
      return fail(e);
    }
  });

  // 备份存档（复制到 <实例>/backups/saves/，返回备份目录路径列表）
  ipcMain.handle('instance:saves-backup', async (_event, payload: {
    instancePath?: string;
    dirNames?: string[];
  }) => {
    try {
      return ok(backupInstanceSaves(readInstancePath(payload), readNameList(payload, 'dirNames')));
    } catch (e: unknown) {
      return fail(e);
    }
  });

  // 截图列表（含 320px 缩略 dataURL）
  ipcMain.handle('instance:screenshots-list', async (_event, payload: { instancePath?: string }) => {
    try {
      return ok(listInstanceScreenshots(readInstancePath(payload)));
    } catch (e: unknown) {
      return fail(e);
    }
  });

  // 删除截图（按文件名，basename 校验）
  ipcMain.handle('instance:screenshots-delete', async (_event, payload: {
    instancePath?: string;
    fileNames?: string[];
  }) => {
    try {
      return ok(deleteInstanceScreenshots(readInstancePath(payload), readNameList(payload, 'fileNames')));
    } catch (e: unknown) {
      return fail(e);
    }
  });

  // 资源包 / 光影包列表（只读，启用状态按 .disabled / .old 后缀判断）
  ipcMain.handle('instance:resourcepacks-list', async (_event, payload: { instancePath?: string }) => {
    try {
      return ok(listInstanceResourcePacks(readInstancePath(payload)));
    } catch (e: unknown) {
      return fail(e);
    }
  });
}
