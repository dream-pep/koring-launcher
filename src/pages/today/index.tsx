import { memo, startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@heroui/react";
import { AlertCircle, ExternalLink, Newspaper, RefreshCw } from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";
import { getNews, getNewsTypes, type NewsEntry } from "@/api/news";
import { Skeleton } from "@/components/ui/skeleton";

/** 每次加载的条数（3 列布局下正好一行） */
const PAGE_SIZE = 12;
/** 触底预加载提前量：距列表底部约一行（含卡片高度 + 间距）时就开始取下一页 */
const PRELOAD_ROOT_MARGIN = "0px 0px 420px 0px";
const PRELOAD_OFFSET_PX = 420;
/** 两次自动加载之间的最小间隔，避免滚动抖动触发连发 */
const LOAD_COOLDOWN_MS = 320;

/** newsType → 中文标签 */
const TYPE_LABELS: Record<string, string> = {
  Java: "Java 版",
  Bedrock: "基岩版",
  Dungeons: "地下城",
  DungeonsII: "地下城 II",
  Legends: "传奇",
};

/** 已知类型的展示顺序 */
const TYPE_ORDER = Object.keys(TYPE_LABELS);

function typeLabel(type: string): string {
  return TYPE_LABELS[type] ?? type;
}

function formatDate(date: string): string {
  return date ? date.replace(/-/g, "/") : "";
}

function formatTime(timestamp: number): string {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

/** 用系统浏览器打开官方原文（minecraft.net） */
function openLink(url: string | null) {
  if (!url) return;
  const api = window.electronAPI;
  if (!api) {
    toast.error("请在桌面客户端中使用此功能");
    return;
  }
  api.openExternal(url).catch(() => toast.error("无法打开外部链接"));
}

/** 追加时按 id 去重，避免分页边界重复渲染同一条 */
function appendUnique(previous: NewsEntry[], incoming: NewsEntry[]): NewsEntry[] {
  if (incoming.length === 0) return previous;
  const seen = new Set(previous.map((entry) => entry.id));
  const next = incoming.filter((entry) => !seen.has(entry.id));
  return next.length === 0 ? previous : [...previous, ...next];
}

interface NewsCardProps {
  entry: NewsEntry;
}

/** 网格中的资讯卡片（memo：翻页追加时旧卡片不重渲染） */
const NewsCard = memo(function NewsCard({ entry }: NewsCardProps) {
  return (
    <button
      type="button"
      onClick={() => openLink(entry.readMoreLink)}
      className={clsx(
        "group flex flex-col overflow-hidden rounded-2xl border text-left transition-colors",
        "border-border/40 dark:border-white/[0.08] bg-white/70 dark:bg-black/30 backdrop-blur-sm",
        "hover:border-primary/40 dark:hover:border-primary/40"
      )}
    >
      <div className="relative aspect-[772/350] w-full overflow-hidden bg-foreground/[0.04] dark:bg-white/[0.04]">
        {entry.imageUrl ? (
          <img
            src={entry.imageUrl}
            alt={entry.title}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Newspaper className="h-8 w-8 text-muted-foreground/30" />
          </div>
        )}
        {entry.tag && (
          <span className="absolute left-2 top-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
            {entry.tag}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3.5">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
          <span className="shrink-0">{formatDate(entry.date)}</span>
          {entry.category && (
            <>
              <span className="text-muted-foreground/30">·</span>
              <span className="truncate">{entry.category}</span>
            </>
          )}
        </div>
        <h3 className="line-clamp-2 text-[14px] font-semibold leading-snug text-foreground">
          {entry.title}
        </h3>
        {entry.summary && (
          <p className="line-clamp-2 text-[12px] leading-relaxed text-muted-foreground">
            {entry.summary}
          </p>
        )}
        <span className="mt-auto inline-flex items-center gap-1 pt-1 text-[11px] text-primary/80 group-hover:text-primary">
          阅读原文
          <ExternalLink className="h-3 w-3" />
        </span>
      </div>
    </button>
  );
});

interface FeaturedNewsProps {
  entry: NewsEntry;
}

/** 首屏大图资讯（memo，翻页时保持稳定） */
const FeaturedNews = memo(function FeaturedNews({ entry }: FeaturedNewsProps) {
  const image = entry.imageUrl ?? entry.heroImageUrl;
  return (
    <button
      type="button"
      onClick={() => openLink(entry.readMoreLink)}
      className={clsx(
        "group relative block w-full overflow-hidden rounded-2xl border text-left",
        "border-border/40 dark:border-white/[0.08]",
        "hover:border-primary/40 dark:hover:border-primary/40 transition-colors"
      )}
    >
      <div className="relative aspect-[772/350] w-full bg-foreground/[0.04] dark:bg-white/[0.04]">
        {image ? (
          <img
            src={image}
            alt={entry.title}
            decoding="async"
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Newspaper className="h-12 w-12 text-muted-foreground/20" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 space-y-1.5 p-5">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-white/70">
            <span>{formatDate(entry.date)}</span>
            {entry.category && (
              <>
                <span className="text-white/40">·</span>
                <span>{entry.category}</span>
              </>
            )}
            {entry.newsType.slice(0, 2).map((type) => (
              <span key={type} className="rounded bg-white/15 px-1.5 py-0.5 text-[10px] text-white/85">
                {typeLabel(type)}
              </span>
            ))}
          </div>
          <h2 className="line-clamp-2 text-lg font-bold leading-snug text-white">{entry.title}</h2>
          {entry.summary && (
            <p className="line-clamp-2 max-w-3xl text-[12px] leading-relaxed text-white/75">
              {entry.summary}
            </p>
          )}
          <span className="inline-flex items-center gap-1 pt-1 text-[11px] text-white/85 group-hover:text-white">
            阅读原文
            <ExternalLink className="h-3 w-3" />
          </span>
        </div>
      </div>
    </button>
  );
});

/** 卡片骨架（保持与真实卡片同高，避免加载时布局跳动） */
function CardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/40 dark:border-white/[0.08]">
      <Skeleton className="aspect-[772/350] w-full rounded-none" />
      <div className="space-y-2 p-3.5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    </div>
  );
}

/** 首屏骨架 */
function NewsSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="aspect-[772/350] w-full rounded-2xl" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <CardSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}

export function Today() {
  const [entries, setEntries] = useState<NewsEntry[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [fetchedAt, setFetchedAt] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moreError, setMoreError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [activeType, setActiveType] = useState<string | null>(null);
  const [sentinel, setSentinel] = useState<HTMLDivElement | null>(null);

  const scrollRootRef = useRef<HTMLDivElement | null>(null);
  /** 已加载到的偏移量（下一页起点） */
  const offsetRef = useRef(0);
  /** 是否有请求在飞（并发保护：滚动触发再多次也只发一个） */
  const loadingRef = useRef(false);
  /** 请求令牌：切换筛选/刷新后旧响应直接丢弃，避免串数据 */
  const tokenRef = useRef(0);
  const tokenSeqRef = useRef(0);
  /** 上次请求时间（冷却，防连发） */
  const lastLoadAtRef = useRef(0);
  const hasMoreRef = useRef(false);

  const load = useCallback(
    async (options: { reset: boolean; refresh: boolean }) => {
      // 追加加载：有请求在飞或仍在冷却期 → 直接跳过（防抖/防连发）
      if (!options.reset) {
        if (loadingRef.current) return;
        if (Date.now() - lastLoadAtRef.current < LOAD_COOLDOWN_MS) return;
      }

      const token = ++tokenSeqRef.current;
      tokenRef.current = token;
      loadingRef.current = true;
      lastLoadAtRef.current = Date.now();

      const offset = options.reset ? 0 : offsetRef.current;
      if (options.reset) {
        setInitialLoading(true);
        setError(null);
      } else {
        setLoadingMore(true);
      }
      setMoreError(null);

      try {
        const result = await getNews({
          newsType: activeType ?? undefined,
          limit: PAGE_SIZE,
          offset,
          refresh: options.refresh,
        });
        // 过期响应（期间切换了筛选或又刷新过）→ 丢弃
        if (token !== tokenRef.current) return;

        const loaded = offset + result.entries.length;
        offsetRef.current = loaded;
        setTotal(result.total);
        setFetchedAt(result.fetchedAt);
        setHasMore(loaded < result.total);

        if (options.reset) {
          setEntries(result.entries);
        } else {
          // 追加走 transition：不阻塞滚动/输入
          startTransition(() => {
            setEntries((previous) => appendUnique(previous, result.entries));
          });
        }
      } catch (e) {
        if (token === tokenRef.current) {
          const message = e instanceof Error ? e.message : String(e);
          if (options.reset) {
            setError(message);
          } else {
            setMoreError(message);
          }
        }
      } finally {
        if (token === tokenRef.current) {
          loadingRef.current = false;
          setInitialLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [activeType]
  );

  // 首次进入 / 切换平台 → 重置分页重新拉第一页
  useEffect(() => {
    void load({ reset: true, refresh: false });
  }, [load]);

  // 平台筛选项（主进程从全量数据推导，不受分页影响）
  useEffect(() => {
    let cancelled = false;
    getNewsTypes()
      .then((result) => {
        if (!cancelled) setTypes(result);
      })
      .catch(() => {
        // 筛选项失败不影响列表展示
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const sortedTypes = useMemo(
    () =>
      [...types].sort((a, b) => {
        const left = TYPE_ORDER.indexOf(a);
        const right = TYPE_ORDER.indexOf(b);
        return (left < 0 ? 99 : left) - (right < 0 ? 99 : right);
      }),
    [types]
  );

  // 哨兵进入「距底部一行」范围 → 预加载下一页（IntersectionObserver，不监听 scroll，主线程零开销）
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);
  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);

  useEffect(() => {
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (records) => {
        if (!records.some((record) => record.isIntersecting)) return;
        if (!hasMoreRef.current || loadingRef.current) return;
        void loadRef.current({ reset: false, refresh: false });
      },
      { root: null, rootMargin: PRELOAD_ROOT_MARGIN, threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sentinel]);

  // 兜底补齐：内容不足一屏（哨兵一直落在预加载范围内）时 IntersectionObserver 不会再触发，
  // 这里在每批加载完成后检查一次哨兵位置，仍在范围内就按冷却节奏继续取下一页。
  useEffect(() => {
    if (initialLoading || loadingMore || !hasMore || !sentinel) return;
    const rect = sentinel.getBoundingClientRect();
    if (rect.top > (window.innerHeight || 0) + PRELOAD_OFFSET_PX) return;
    const timer = window.setTimeout(() => {
      if (!loadingRef.current) void loadRef.current({ reset: false, refresh: false });
    }, LOAD_COOLDOWN_MS + 20);
    return () => window.clearTimeout(timer);
  }, [initialLoading, loadingMore, hasMore, entries.length, sentinel]);

  const refresh = useCallback(() => {
    void load({ reset: true, refresh: true });
    getNewsTypes(true)
      .then((result) => setTypes(result))
      .catch(() => {
        // 筛选项刷新失败保留旧值
      });
  }, [load]);

  const selectType = useCallback((next: string | null) => {
    setActiveType(next);
    // 切筛选回到顶部，避免停留在旧列表底部
    scrollRootRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  const featured = entries[0];
  const list = entries.slice(1);

  return (
    <div ref={scrollRootRef} className="p-6 h-full overflow-y-auto scroll-area">
      {/* 头部 */}
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-foreground">资讯</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Minecraft 官方新闻与更新动态
            {fetchedAt > 0 && !initialLoading ? ` · 更新于 ${formatTime(fetchedAt)}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onPress={refresh}
            isDisabled={initialLoading}
            className="min-w-0 w-8 h-8 p-0"
            aria-label="刷新资讯"
          >
            <RefreshCw className={clsx("h-4 w-4", initialLoading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* 平台筛选 */}
      {sortedTypes.length > 1 && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => selectType(null)}
            className={clsx(
              "h-8 rounded-lg border px-2.5 text-[12px] transition-colors",
              activeType === null
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border/40 dark:border-white/[0.08] text-muted-foreground hover:text-foreground"
            )}
          >
            全部
          </button>
          {sortedTypes.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => selectType(type)}
              className={clsx(
                "h-8 rounded-lg border px-2.5 text-[12px] transition-colors",
                activeType === type
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border/40 dark:border-white/[0.08] text-muted-foreground hover:text-foreground"
              )}
            >
              {typeLabel(type)}
            </button>
          ))}
        </div>
      )}

      {/* 内容 */}
      {initialLoading && entries.length === 0 ? (
        <NewsSkeleton />
      ) : error ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/40 py-20 dark:border-white/[0.08]">
          <AlertCircle className="h-6 w-6 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">资讯加载失败</p>
          <p className="max-w-lg text-center text-[12px] text-muted-foreground/60">{error}</p>
          <Button size="sm" variant="ghost" onPress={refresh}>
            重试
          </Button>
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/40 py-20 dark:border-white/[0.08]">
          <Newspaper className="h-6 w-6 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">暂时没有资讯</p>
        </div>
      ) : (
        <div className="space-y-4">
          {featured && <FeaturedNews entry={featured} />}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((entry) => (
              <NewsCard key={entry.id} entry={entry} />
            ))}
            {/* 追加加载中的占位卡片：与真实卡片同结构，避免高度跳动 */}
            {loadingMore && (
              <>
                <CardSkeleton />
                <CardSkeleton />
                <CardSkeleton />
              </>
            )}
          </div>

          {/* 触底哨兵：距底部约一行时开始预加载 */}
          {hasMore && <div ref={setSentinel} className="h-px w-full" aria-hidden="true" />}

          {moreError && (
            <div className="flex items-center justify-center gap-3 rounded-xl border border-dashed border-border/40 py-4 text-[12px] text-muted-foreground dark:border-white/[0.08]">
              <AlertCircle className="h-3.5 w-3.5" />
              加载更多失败
              <Button
                size="sm"
                variant="ghost"
                onPress={() => void load({ reset: false, refresh: false })}
              >
                重试
              </Button>
            </div>
          )}

          {!hasMore && !loadingMore && (
            <p className="py-2 text-center text-[11px] text-muted-foreground/50">
              已经到底啦 · 共 {total} 条
            </p>
          )}
        </div>
      )}

      {!initialLoading && !error && entries.length > 0 && (
        <p className="mt-4 text-center text-[11px] text-muted-foreground/50">
          数据来源：Minecraft 官方启动器内容接口（launchercontent.mojang.com）
        </p>
      )}
    </div>
  );
}
