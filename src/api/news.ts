import { ipcInvoke } from './ipc';

/** 单条 Minecraft 官方资讯（字段与主进程 electron/core/news.ts 保持一致） */
export interface NewsEntry {
  id: string;
  title: string;
  /** 纯文本摘要 */
  summary: string;
  /** 归属分类，如 "Minecraft for Windows" / "Minecraft: Java Edition" */
  category: string;
  /** 归属平台：Java / Bedrock / Dungeons / DungeonsII / Legends / News page */
  newsType: string[];
  /** 发布日期 YYYY-MM-DD */
  date: string;
  /** 官方标签，如 "news" / "New" / "Java Realms" */
  tag: string | null;
  /** 资讯卡片图（772x350） */
  imageUrl: string | null;
  /** 首页大图（700x466） */
  heroImageUrl: string | null;
  /** 「阅读全文」外链（minecraft.net） */
  readMoreLink: string | null;
  cardBorder: boolean;
}

export interface NewsListResult {
  entries: NewsEntry[];
  /** 过滤后的总条数 */
  total: number;
  /** 数据抓取时间戳（ms） */
  fetchedAt: number;
  /** 本次结果是否来自主进程缓存 */
  cached: boolean;
}

export interface NewsQuery {
  category?: string;
  newsType?: string;
  search?: string;
  limit?: number;
  offset?: number;
  /** true = 跳过 10 分钟缓存强制刷新 */
  refresh?: boolean;
}

/** 拉取 Minecraft 官方资讯（数据源 launchercontent.mojang.com，主进程带 10 分钟缓存） */
export async function getNews(query: NewsQuery = {}): Promise<NewsListResult> {
  return ipcInvoke<NewsListResult>('news:list', query);
}

/** 可用平台筛选项（Java / Bedrock / Dungeons / DungeonsII / Legends） */
export async function getNewsTypes(refresh = false): Promise<string[]> {
  return ipcInvoke<string[]>('news:types', { refresh });
}
