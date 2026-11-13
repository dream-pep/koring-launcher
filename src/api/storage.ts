/**
 * 存储占用扫描 API（设置 → 通用 → 存储）。
 * 类型与主进程 electron/core/storage.ts 保持一致（electron/ 与 src/ 无共享类型模块，需手动同步）。
 */
import { ipcInvoke, onIpcEvent } from './ipc';

/** 类别色调：渲染端按 tone 取基础色，location 再按 colorIndex 取色板 */
export type StorageTone = 'cache' | 'online' | 'update' | 'instance' | 'device' | 'secure' | 'other';

/** 一条占用条目（可为分组行或明细行） */
export interface StorageEntry {
  id: string;
  label: string;
  path: string;
  bytes: number;
  exists: boolean;
  detail?: string;
  tone: StorageTone;
  /** 安装位置专用：色板下标（按位置顺序） */
  colorIndex?: number;
  children: StorageEntry[];
}

export interface StorageSection {
  id: 'software' | 'instances' | 'device' | 'secure' | 'other';
  title: string;
  /** 分类基准色（device / secure / other 三组在长条中各聚合为一片） */
  tone: StorageTone;
  bytes: number;
  entries: StorageEntry[];
}

/** 圆环图的一片：顶层条目的扁平投影 */
export interface StorageSlice {
  id: string;
  label: string;
  bytes: number;
  tone: StorageTone;
  colorIndex?: number;
}

export interface StorageReport {
  sections: StorageSection[];
  slices: StorageSlice[];
  totalBytes: number;
  scannedFiles: number;
  skipped: number;
  warnings: string[];
  userDataPath: string;
  durationMs: number;
  scannedAt: number;
}

export type StorageScanPhase = 'preparing' | 'scanning' | 'aggregating' | 'done';

export interface StorageScanProgress {
  phase: StorageScanPhase;
  label: string;
  current: number;
  total: number;
  scannedBytes: number;
  scannedFiles: number;
}

/** 触发一次存储统计（主进程对并发请求去重，共享同一次扫描结果） */
export async function scanStorage(): Promise<StorageReport> {
  return ipcInvoke<StorageReport>('storage:scan');
}

/** 订阅扫描进度（节流推送） */
export function onStorageProgress(handler: (progress: StorageScanProgress) => void): () => void {
  return onIpcEvent<StorageScanProgress>('storage:progress', handler);
}
