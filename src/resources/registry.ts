/**
 * 资源注册表服务（程序本体运行时资源管理核心）。
 *
 * 职责：加载 → 缓存 → 引用计数 → 预算/LRU 逐出 → 释放回调。
 * - 同一 key 并发 acquire 只会执行一次 load；
 * - 超预算时按 LRU 逐出「引用数 = 0 且已就绪」的条目；
 * - 逐出/清除时调用条目的 onRelease（如 revokeObjectURL / ImageBitmap.close），
 *   确保底层内存可被回收；
 * - 与 React 解耦，通过 subscribe 提供给调试/监控层。
 */

import {
  DEFAULT_BUDGETS,
  type RegistrySnapshot,
  type RegistryStats,
  type ResourceEntrySnapshot,
  type ResourceKind,
} from "./types";

export interface AcquireOptions<T> {
  /** 估算占用字节数（用于预算与面板统计；未提供则记 0） */
  bytes?: number;
  /** 资源加载器；同一 key 并发时只会执行一次 */
  load: () => Promise<T | null>;
  /** 条目被逐出/清除时回调（用于真正释放底层资源） */
  onRelease?: (payload: T) => void;
  /** 是否在 release 后仍缓存结果供复用；默认 true。false 表示「当前唯一持有者」语义（如背景图） */
  cache?: boolean;
}

interface InternalEntry {
  key: string;
  kind: ResourceKind;
  bytes: number;
  refs: number;
  lastUsed: number;
  settled: boolean;
  payload: unknown;
  inFlight: Promise<unknown> | null;
  cache: boolean;
  onRelease?: (payload: unknown) => void;
}

type Listener = () => void;

class ResourceRegistry {
  private entries = new Map<string, InternalEntry>();
  private budgets: Record<ResourceKind, number> = { ...DEFAULT_BUDGETS };
  private hits = 0;
  private misses = 0;
  private evictions = 0;
  private listeners = new Set<Listener>();
  private pendingEmit: ReturnType<typeof setTimeout> | null = null;
  private lastEmitAt = 0;

  /** 调整某类资源的预算（字节） */
  setBudget(kind: ResourceKind, bytes: number): void {
    this.budgets[kind] = Math.max(0, Math.floor(bytes));
    this.evict();
    this.emitNow();
  }

  getBudget(kind: ResourceKind): number {
    return this.budgets[kind];
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * 获取（或注册）一个资源。返回与 load 结果一致的 Promise。
   * 调用方应在不再需要时调用 release(key)，引用数归零后条目才可被逐出。
   */
  acquire<T>(key: string, kind: ResourceKind, opts: AcquireOptions<T>): Promise<T | null> {
    const existing = this.entries.get(key);
    if (existing) {
      existing.refs += 1;
      existing.lastUsed = Date.now();
      if (existing.settled) {
        this.hits += 1;
        this.emit();
        return Promise.resolve(existing.payload as T | null);
      }
      return existing.inFlight as Promise<T | null>;
    }

    this.misses += 1;
    const entry: InternalEntry = {
      key,
      kind,
      bytes: Math.max(0, Math.floor(opts.bytes ?? 0)),
      refs: 1,
      lastUsed: Date.now(),
      settled: false,
      payload: null,
      inFlight: null,
      cache: opts.cache ?? true,
    };
    this.entries.set(key, entry);
    // 用桥接闭包把调用方的 (payload: T) => void 适配为内部 (payload: unknown) => void
    entry.onRelease = opts.onRelease ? (payload: unknown): void => opts.onRelease?.(payload as T) : undefined;

    const run = async (): Promise<T | null> => {
      let value: T | null = null;
      try {
        value = await opts.load();
      } catch {
        value = null;
      }
      entry.payload = value;
      entry.settled = true;
      entry.inFlight = null;
      if (entry.refs <= 0) {
        // 加载期间所有引用都已释放：直接丢弃，不保留缓存
        this.drop(entry);
      } else {
        this.evict();
      }
      this.emit();
      return value;
    };

    entry.inFlight = run();
    return entry.inFlight as Promise<T | null>;
  }

  /** 释放一次引用。cache=false 且引用归零时立即丢弃条目。 */
  release(key: string): void {
    const entry = this.entries.get(key);
    if (!entry) return;
    entry.refs = Math.max(0, entry.refs - 1);
    entry.lastUsed = Date.now();
    if (!entry.cache && entry.refs === 0) {
      this.drop(entry);
      this.emit();
      return;
    }
    if (entry.refs === 0 && entry.settled) {
      this.evict();
    }
    this.emit();
  }

  /** 是否持有（含加载中）某 key */
  has(key: string): boolean {
    return this.entries.has(key);
  }

  /** 加载完成后按实际占用修正估算字节（如解码产物实际大小） */
  setBytes(key: string, bytes: number): void {
    const entry = this.entries.get(key);
    if (!entry) return;
    entry.bytes = Math.max(0, Math.floor(bytes));
    if (entry.settled) {
      this.evict();
    }
    this.emit();
  }

  /** 释放全部「引用数为 0」的缓存条目（监控面板「释放缓存」按钮） */
  clearFree(): void {
    let dropped = false;
    for (const entry of [...this.entries.values()]) {
      if (entry.refs <= 0 && entry.settled) {
        this.drop(entry);
        dropped = true;
      }
    }
    if (dropped) this.emitNow();
  }

  /** 逐出超过预算的条目（LRU，仅引用数为 0 的已就绪条目） */
  evict(): void {
    const budgets = this.budgets;
    for (const kind of Object.keys(budgets) as ResourceKind[]) {
      const settled = [...this.entries.values()].filter((e) => e.kind === kind && e.settled);
      let bytes = settled.reduce((sum, e) => sum + e.bytes, 0);
      if (bytes <= budgets[kind]) continue;
      const free = settled
        .filter((e) => e.refs === 0)
        .sort((a, b) => a.lastUsed - b.lastUsed);
      for (const entry of free) {
        if (bytes <= budgets[kind]) break;
        bytes -= entry.bytes;
        this.drop(entry);
        this.evictions += 1;
      }
    }
  }

  stats(): RegistryStats {
    const byKind: RegistryStats["byKind"] = {};
    let totalBytes = 0;
    let entries = 0;
    for (const entry of this.entries.values()) {
      if (!entry.settled) continue;
      entries += 1;
      totalBytes += entry.bytes;
      const group = (byKind[entry.kind] ??= { count: 0, bytes: 0 });
      group.count += 1;
      group.bytes += entry.bytes;
    }
    return {
      entries,
      totalBytes,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      byKind,
    };
  }

  snapshot(): RegistrySnapshot {
    const entrySnapshots: ResourceEntrySnapshot[] = [];
    for (const entry of this.entries.values()) {
      if (!entry.settled) continue;
      entrySnapshots.push({
        key: entry.key,
        kind: entry.kind,
        bytes: entry.bytes,
        refs: entry.refs,
      });
    }
    entrySnapshots.sort((a, b) => b.bytes - a.bytes);
    return { stats: this.stats(), entries: entrySnapshots };
  }

  resetCounters(): void {
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
    this.emitNow();
  }

  private drop(entry: InternalEntry): void {
    this.entries.delete(entry.key);
    if (entry.settled && entry.payload != null) {
      try {
        entry.onRelease?.(entry.payload);
      } catch {
        // 释放回调失败不影响主流程
      }
    }
  }

  private emit(): void {
    const now = Date.now();
    if (now - this.lastEmitAt >= 200) {
      this.emitNow();
      return;
    }
    if (this.pendingEmit) return;
    this.pendingEmit = setTimeout(() => {
      this.pendingEmit = null;
      this.emitNow();
    }, 200);
  }

  private emitNow(): void {
    this.lastEmitAt = Date.now();
    for (const listener of this.listeners) {
      try {
        listener();
      } catch {
        // 单个监听器异常不影响其它监听器
      }
    }
  }
}

/** 全局单例（程序本体资源管理服务） */
export const resourceRegistry = new ResourceRegistry();
