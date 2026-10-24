/**
 * 实例资产 API（渲染端）：存档 / 截图 / 资源包。
 *
 * 与 `electron/core/instance-assets.ts` 的返回结构保持一致；
 * 渲染端不能直接引用主进程类型（tsconfig 分离），所以这里独立声明一份类型。
 */

import { ipcInvoke } from './ipc';

/** 存档（saves/ 下的一个目录） */
export interface SaveInfo {
  /** 存档目录名（= 回退显示名） */
  dirName: string;
  /** 存档目录绝对路径 */
  dirPath: string;
  /** level.dat 中的显示名（LevelName）；解析失败为目录名 */
  levelName: string;
  /** level.dat 是否存在（损坏 / 不完整存档也能展示） */
  hasLevelDat: boolean;
  /** 目录总大小（字节） */
  sizeBytes: number;
  /** 最后修改时间（毫秒时间戳） */
  lastModified: number;
  /** icon.png 的 96px 缩略 dataURL；无图标为 null */
  iconDataUrl: string | null;
}

/** 截图 */
export interface ScreenshotInfo {
  fileName: string;
  filePath: string;
  sizeBytes: number;
  /** 最后修改时间（毫秒时间戳） */
  mtime: number;
  /** 320px 宽缩略 dataURL；解码失败为 null */
  thumbDataUrl: string | null;
}

/** 资源包种类 */
export type ResourcePackKind = 'resourcepack' | 'shaderpack';

/** 资源包 / 光影包（只读） */
export interface ResourcePackInfo {
  /** 磁盘真实文件名（可能带 .disabled / .old 后缀） */
  fileName: string;
  /** 去掉 .disabled / .old 后缀的展示名 */
  rawFileName: string;
  filePath: string;
  kind: ResourcePackKind;
  sizeBytes: number;
  /** 是否启用（.disabled / .old 后缀 = 已禁用） */
  enabled: boolean;
  /** 最后修改时间（毫秒时间戳） */
  mtime: number;
}

/** 批量删除结果 */
export interface DeleteResult {
  deleted: string[];
  failed: { name: string; error: string }[];
}

/** 扫描实例存档列表（按最后修改时间倒序） */
export async function listInstanceSaves(instancePath: string): Promise<SaveInfo[]> {
  return ipcInvoke<SaveInfo[]>('instance:saves-list', { instancePath });
}

/** 删除指定存档目录（幂等；不存在视为已删除） */
export async function deleteInstanceSaves(instancePath: string, dirNames: string[]): Promise<DeleteResult> {
  return ipcInvoke<DeleteResult>('instance:saves-delete', { instancePath, dirNames });
}

/** 备份指定存档目录，返回备份目录绝对路径列表 */
export async function backupInstanceSaves(instancePath: string, dirNames: string[]): Promise<string[]> {
  return ipcInvoke<string[]>('instance:saves-backup', { instancePath, dirNames });
}

/** 扫描实例截图列表（含缩略图，按修改时间倒序） */
export async function listInstanceScreenshots(instancePath: string): Promise<ScreenshotInfo[]> {
  return ipcInvoke<ScreenshotInfo[]>('instance:screenshots-list', { instancePath });
}

/** 删除指定截图文件（幂等；不存在视为已删除） */
export async function deleteInstanceScreenshots(instancePath: string, fileNames: string[]): Promise<DeleteResult> {
  return ipcInvoke<DeleteResult>('instance:screenshots-delete', { instancePath, fileNames });
}

/** 扫描资源包 / 光影包列表（只读） */
export async function listInstanceResourcePacks(instancePath: string): Promise<ResourcePackInfo[]> {
  return ipcInvoke<ResourcePackInfo[]>('instance:resourcepacks-list', { instancePath });
}
