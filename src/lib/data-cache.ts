/**
 * 前端数据缓存（模块级，进程内）。
 *
 * 页面在路由切换时会被重新挂载（`<Page key={current} />`），如果每次都重新
 * 走一遍 IPC 拉数据，就会出现「刚看过的东西再点回去又转圈」。这里给读接口
 * 加一层带 TTL 的缓存：
 * - 命中且未过期 → 直接返回上次结果（同步可读：`peek`）；
 * - 过期但仍在飞行中 → 复用同一个 Promise，避免并发重复请求；
 * - 需要最新数据时（用户点「刷新」、或数据被写操作改过）→ 调用 `invalidate`。
 *
 * 写操作（安装/删除/重命名等）结束后请调用 `invalidate("instances:")` 之类，
 * 否则页面会看到过期列表。
 */

interface CacheEntry<T> {
  value: T;
  /** 写入时间 */
  at: number;
}

/** 常见 TTL（毫秒）：按数据变化频率分档 */
export const CACHE_TTL = {
  /** 频繁变化：实例列表、日志类 */
  short: 15_000,
  /** 一般：新闻、搜索结果、Mod 列表 */
  medium: 60_000,
  /** 基本不变：版本清单、分类、系统信息 */
  long: 10 * 60_000,
} as const;

const entries = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

/** 同步读缓存（未命中或已过期返回 undefined），用于页面初始 state，避免闪一下骨架屏 */
export function peek<T>(key: string, ttlMs: number): T | undefined {
  const hit = entries.get(key) as CacheEntry<T> | undefined;
  if (!hit) return undefined;
  if (Date.now() - hit.at >= ttlMs) return undefined;
  return hit.value;
}

/**
 * 带缓存的读取：
 * - 未过期直接返回；
 * - 同一 key 并发调用共享同一个 Promise；
 * - 失败不写缓存（下次会重试）。
 */
export function cached<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
  const hit = peek<T>(key, ttlMs);
  if (hit !== undefined) return Promise.resolve(hit);

  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const promise = fetcher()
    .then((value) => {
      entries.set(key, { value, at: Date.now() });
      return value;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, promise);
  return promise;
}

/** 主动写入（拿写操作的返回值刷新缓存，例如安装完成后的实例信息） */
export function put<T>(key: string, value: T): void {
  entries.set(key, { value, at: Date.now() });
}

/**
 * 让缓存失效。
 * @param prefix 只清理以该前缀开头的 key；不传则清空全部
 */
export function invalidate(prefix?: string): void {
  if (!prefix) {
    entries.clear();
    return;
  }
  for (const key of entries.keys()) {
    if (key.startsWith(prefix)) entries.delete(key);
  }
}

/** 按稳定顺序拼 cache key（对象参数用 JSON） */
export function cacheKey(scope: string, ...parts: unknown[]): string {
  return `${scope}:${parts
    .map((part) => (part === undefined || part === null ? "" : typeof part === "string" ? part : JSON.stringify(part)))
    .join("|")}`;
}
