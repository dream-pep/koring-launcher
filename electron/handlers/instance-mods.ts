/**
 * 实例模组本地管理 IPC handlers。
 *
 * 通道：
 * - `instance:mods-list`         → listInstanceMods
 * - `instance:mods-set-enabled`  → setInstanceModsEnabled（payload.enabled: boolean）
 * - `instance:mods-delete`       → deleteInstanceMods
 *
 * 统一返回 `{ success, data, error }`（与 electron/handlers/mods.ts、instance.ts 一致）。
 * 注册入口由 electron/main.ts 统一调用（本文件不自行注册）。
 */

import electron from 'electron';
import {
  listInstanceMods,
  setInstanceModsEnabled,
  deleteInstanceMods,
} from '../core/instance-mods';
import { createLogger } from '../core/logger';

const { ipcMain } = electron;
const log = createLogger('instance-mods');

/** 统一成功包装 */
function ok(data: unknown) {
  return { success: true, data, error: null };
}

/** 统一失败包装 */
function fail(e: unknown) {
  return { success: false, data: null, error: e instanceof Error ? e.message : String(e) };
}

/** 实例内模组的 payload 公共字段 */
interface InstanceModsPayload {
  /** 实例目录绝对路径（实例根，不是 gameDir） */
  instancePath: string;
  fileNames?: string[];
}

/** 校验实例路径：必须是非空字符串（绝对路径由核心层 path.resolve 归一化） */
function requireInstancePath(instancePath: unknown): string {
  if (typeof instancePath !== 'string' || !instancePath.trim()) {
    throw new Error('缺少实例路径（instancePath）');
  }
  return instancePath;
}

export function registerInstanceModsHandlers() {
  // 列出实例内本地 Mod（启用 / 禁用分开返回）
  ipcMain.handle('instance:mods-list', async (_event, payload: InstanceModsPayload) => {
    try {
      const instancePath = requireInstancePath(payload?.instancePath);
      return ok(listInstanceMods(instancePath));
    } catch (e: unknown) {
      log.error('列举实例 Mod 失败', e);
      return fail(e);
    }
  });

  // 批量启用 / 禁用
  ipcMain.handle('instance:mods-set-enabled', async (_event, payload: InstanceModsPayload & { enabled?: boolean }) => {
    try {
      const instancePath = requireInstancePath(payload?.instancePath);
      if (typeof payload?.enabled !== 'boolean') {
        throw new Error('缺少启用状态（enabled）');
      }
      const fileNames = Array.isArray(payload.fileNames) ? payload.fileNames : [];
      return ok(setInstanceModsEnabled(instancePath, fileNames, payload.enabled));
    } catch (e: unknown) {
      log.error('启用/禁用实例 Mod 失败', e);
      return fail(e);
    }
  });

  // 批量删除
  ipcMain.handle('instance:mods-delete', async (_event, payload: InstanceModsPayload) => {
    try {
      const instancePath = requireInstancePath(payload?.instancePath);
      const fileNames = Array.isArray(payload?.fileNames) ? payload.fileNames : [];
      return ok(deleteInstanceMods(instancePath, fileNames));
    } catch (e: unknown) {
      log.error('删除实例 Mod 失败', e);
      return fail(e);
    }
  });
}
