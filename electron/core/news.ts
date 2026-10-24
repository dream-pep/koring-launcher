/**
 * Minecraft 官方资讯（Mojang launcher content）
 *
 * 数据源：https://launchercontent.mojang.com/v2/news.json
 * 这是官方启动器首页/资讯页使用的同一份数据，字段包含标题、日期、摘要、
 * 两种尺寸配图、外链与归属平台（newsType）。
 *
 * 设计要点：
 * - 只在主进程发起网络请求（渲染端不直连外网），统一走 Electron net.fetch；
 * - 内存缓存 10 分钟 + 并发去重（多个页面同时请求只打一次网络）；
 * - 图片是相对路径，这里统一拼成绝对地址再返回给渲染端；
 * - 过滤/分页放在主进程，渲染端只负责展示（UI 由人工设计时可直接用这些参数）。
 */

import electron from 'electron';
import { createLogger } from './logger';

const { net } = electron;

const NEWS_API = 'https://launchercontent.mojang.com/v2/news.json';
const CONTENT_BASE = 'https://launchercontent.mojang.com';
const CACHE_TTL_MS = 10 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 15 * 1000;

const log = createLogger('news');

/** 单条资讯（已归一化，供渲染端直接展示） */
export interface NewsEntry {
  /** 官方内容 id（sha256） */
  id: string;
  title: string;
  /** 纯文本摘要（已压缩空白） */
  summary: string;
  /** 归属分类，如 "Minecraft for Windows" / "Minecraft: Java Edition" */
  category: string;
  /** 归属平台：Java / Bedrock / Dungeons / DungeonsII / Legends / News page */
  newsType: string[];
  /** 发布日期 YYYY-MM-DD */
  date: string;
  /** 官方标签（可能为 null），如 "news" / "New" / "Java Realms" */
  tag: string | null;
  /** 资讯页卡片图（772x350）绝对地址 */
  imageUrl: string | null;
  /** 首页大图（700x466）绝对地址 */
  heroImageUrl: string | null;
  /** 「阅读全文」外链（minecraft.net） */
  readMoreLink: string | null;
  /** 官方是否要求卡片描边 */
  cardBorder: boolean;
}

export interface NewsListResult {
  entries: NewsEntry[];
  /** 过滤前的总条数 */
  total: number;
  /** 数据抓取时间戳（ms） */
  fetchedAt: number;
  /** 本次结果是否来自缓存 */
  cached: boolean;
}

export interface NewsQuery {
  /** 精确匹配 category */
  category?: string;
  /** 匹配 newsType（数组包含即算命中） */
  newsType?: string;
  /** 在标题 + 摘要中搜索（不区分大小写） */
  search?: string;
  limit?: number;
  offset?: number;
}

interface RawNewsImage {
  title?: string;
  url?: string;
  dimensions?: { width?: number; height?: number };
}

interface RawNewsEntry {
  id?: string;
  title?: string;
  tag?: string | null;
  category?: string;
  date?: string;
  text?: string;
  playPageImage?: RawNewsImage;
  newsPageImage?: RawNewsImage;
  readMoreLink?: string;
  cardBorder?: boolean;
  newsType?: (string | null)[];
  articleBody?: string;
}

interface RawNewsResponse {
  version?: number;
  entries?: RawNewsEntry[];
}

interface NewsCache {
  entries: NewsEntry[];
  fetchedAt: number;
}

let cache: NewsCache | null = null;
let inflight: Promise<NewsCache> | null = null;

/** 相对路径 → 绝对地址（官方图片均为 /v2/images/xxx.png） */
function toAbsoluteUrl(url?: string | null): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${CONTENT_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
}

function mapEntry(raw: RawNewsEntry): NewsEntry | null {
  const id = raw.id?.trim();
  const title = raw.title?.trim();
  if (!id || !title) return null;
  return {
    id,
    title,
    summary: (raw.text ?? '').replace(/\s+/g, ' ').trim(),
    category: raw.category?.trim() ?? '',
    newsType: Array.isArray(raw.newsType)
      ? raw.newsType.filter((item): item is string => typeof item === 'string' && item.length > 0)
      : [],
    date: raw.date ?? '',
    tag: raw.tag?.trim() || null,
    imageUrl: toAbsoluteUrl(raw.newsPageImage?.url),
    heroImageUrl: toAbsoluteUrl(raw.playPageImage?.url),
    readMoreLink: raw.readMoreLink ?? null,
    cardBorder: Boolean(raw.cardBorder),
  };
}

/** 真正发起一次网络请求（不含缓存判断） */
async function requestNews(): Promise<NewsCache> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await net.fetch(NEWS_API, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`Minecraft 资讯接口返回 HTTP ${response.status}`);
    }
    const data = (await response.json()) as RawNewsResponse;
    const entries = (data.entries ?? [])
      .map(mapEntry)
      .filter((entry): entry is NewsEntry => entry !== null);
    // 官方已按日期倒序，这里再排一次防止接口顺序变化
    entries.sort((a, b) => b.date.localeCompare(a.date));
    const fetchedAt = Date.now();
    log.info(`Minecraft 资讯拉取成功：${entries.length} 条`);
    return { entries, fetchedAt };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.warn(`Minecraft 资讯拉取失败：${message}`);
    throw new Error(`获取 Minecraft 资讯失败：${message}`);
  } finally {
    clearTimeout(timer);
  }
}

/** 取全量资讯（带 10 分钟缓存；force = true 强制刷新） */
async function loadEntries(force: boolean): Promise<{ cache: NewsCache; cached: boolean }> {
  const now = Date.now();
  if (!force && cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return { cache, cached: true };
  }
  // 并发去重：网络请求进行中时复用同一个 Promise
  if (inflight) {
    return { cache: await inflight, cached: true };
  }
  inflight = requestNews();
  try {
    const result = await inflight;
    cache = result;
    return { cache: result, cached: false };
  } finally {
    inflight = null;
  }
}

function matchesQuery(entry: NewsEntry, query: NewsQuery): boolean {
  if (query.category && entry.category !== query.category) return false;
  if (query.newsType && !entry.newsType.includes(query.newsType)) return false;
  const search = query.search?.trim().toLowerCase();
  if (search) {
    const haystack = `${entry.title} ${entry.summary} ${entry.category}`.toLowerCase();
    if (!haystack.includes(search)) return false;
  }
  return true;
}

/**
 * 查询资讯列表。
 * @param query 过滤与分页参数（都不传 = 返回全部）
 * @param force 是否跳过缓存强制刷新
 */
export async function listNews(query: NewsQuery = {}, force = false): Promise<NewsListResult> {
  const { cache: snapshot, cached } = await loadEntries(force);
  const filtered = snapshot.entries.filter((entry) => matchesQuery(entry, query));
  const offset = Math.max(0, query.offset ?? 0);
  const limit = query.limit && query.limit > 0 ? query.limit : filtered.length;
  return {
    entries: filtered.slice(offset, offset + limit),
    total: filtered.length,
    fetchedAt: snapshot.fetchedAt,
    cached,
  };
}

/** 可用的资讯平台筛选项（按官方数据里出现过的 newsType 去重，供 UI 生成标签） */
export async function getNewsTypes(force = false): Promise<string[]> {
  const { cache: snapshot } = await loadEntries(force);
  const types = new Set<string>();
  for (const entry of snapshot.entries) {
    for (const type of entry.newsType) {
      if (type !== 'News page') types.add(type);
    }
  }
  return Array.from(types);
}

/** 清空缓存（调试页 / 手动强制刷新后可调） */
export function clearNewsCache(): void {
  cache = null;
  inflight = null;
}
