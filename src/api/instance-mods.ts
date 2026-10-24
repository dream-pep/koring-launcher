/**
 * 实例模组本地管理（渲染端 API）。
 *
 * 对应主进程 `electron/handlers/instance-mods.ts`：
 * - `instance:mods-list`        列举实例内 Mod（启用 / 禁用）
 * - `instance:mods-set-enabled` 批量启用/禁用（禁用 = 文件名加 `.disabled`）
 * - `instance:mods-delete`      批量删除
 *
 * 只做类型与 IPC 转发，不含 UI。
 */

import { ipcInvoke } from './ipc';

/** 从 jar 元数据识别到的 Mod 加载器；`unknown` = 未解析出 */
export type LocalModLoader = 'fabric' | 'quilt' | 'forge' | 'neoforge' | 'unknown';

/** 实例内单个本地 Mod 文件 */
export interface LocalModInfo {
  /** 磁盘真实文件名（禁用时含 `.disabled` / `.old`） */
  fileName: string;
  /** 绝对路径 */
  filePath: string;
  /** 是否启用 */
  enabled: boolean;
  /** 文件字节数 */
  sizeBytes: number;
  /** 展示名：jar 元数据优先，失败回退文件名 */
  displayName: string;
  /** 版本号；未解析出为空串 */
  version: string;
  /** 加载器；未识别为 `unknown` */
  modLoader: LocalModLoader;
  /** 简介；未解析出为空串 */
  description: string;
  /** 是否成功解析 jar 内元数据 */
  metaParsed: boolean;
  /** 64px 图标缩略图 dataURL（可选） */
  iconDataUrl?: string;
}

/** 实例 Mod 清单（启用 / 禁用分开） */
export interface InstanceModsList {
  mods: LocalModInfo[];
  disabled: LocalModInfo[];
}

/**
 * 启用/禁用/删除的结果。
 * `changed` 为操作成功后的文件名（禁用后带 `.disabled`；删除后即被删文件名）；
 * `skipped` 为未操作的文件名（不存在 / 状态已符合 / 目标重名 / 非法文件名）。
 */
export interface InstanceModsChangeResult {
  changed: string[];
  skipped: string[];
}

/** 列举实例内 Mod：启用放 mods，禁用放 disabled */
export async function listInstanceMods(instancePath: string): Promise<InstanceModsList> {
  return ipcInvoke<InstanceModsList>('instance:mods-list', { instancePath });
}

/** 批量启用/禁用（禁用 = 追加 `.disabled`，启用 = 去掉后缀） */
export async function setInstanceModsEnabled(
  instancePath: string,
  fileNames: string[],
  enabled: boolean
): Promise<InstanceModsChangeResult> {
  return ipcInvoke<InstanceModsChangeResult>('instance:mods-set-enabled', {
    instancePath,
    fileNames,
    enabled,
  });
}

/** 批量删除实例内 Mod 文件 */
export async function deleteInstanceMods(
  instancePath: string,
  fileNames: string[]
): Promise<InstanceModsChangeResult> {
  return ipcInvoke<InstanceModsChangeResult>('instance:mods-delete', {
    instancePath,
    fileNames,
  });
}
