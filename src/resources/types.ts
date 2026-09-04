/**
 * 启动器程序本体「资源管理」类型定义。
 *
 * 这里管理的「资源」指启动器自身运行时持有的渲染资源
 * （背景图 dataURL、远程/本地缩略图位图、Blob、文本缓存等），
 * 与 Minecraft 游戏内容无关。
 */

export type ResourceKind = "background" | "image" | "blob" | "text";

/** 每种资源的默认内存预算（字节），超过后按 LRU 逐出未占用项 */
export const DEFAULT_BUDGETS: Record<ResourceKind, number> = {
  background: 16 * 1024 * 1024, // 背景图（同时只应有一张活跃）
  image: 64 * 1024 * 1024, // 缩略图 / 图标位图
  blob: 32 * 1024 * 1024, // 通用二进制
  text: 4 * 1024 * 1024, // 文本 / JSON 片段
};

export interface ResourceEntrySnapshot {
  key: string;
  kind: ResourceKind;
  bytes: number;
  refs: number;
}

export interface RegistryStats {
  entries: number;
  totalBytes: number;
  hits: number;
  misses: number;
  evictions: number;
  byKind: Partial<Record<ResourceKind, { count: number; bytes: number }>>;
}

export interface RegistrySnapshot {
  stats: RegistryStats;
  entries: ResourceEntrySnapshot[];
}
