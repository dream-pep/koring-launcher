import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Newspaper, RefreshCw } from "lucide-react";
import clsx from "clsx";
import { toast } from "@/lib/toast";
import { getNews, type NewsEntry } from "@/api/news";
import { Skeleton } from "@/components/ui/skeleton";

/** 只取 Java 版资讯 */
const NEWS_TYPE = "Java";
/** 展示条数：3 列布局下两行 */
const PAGE_SIZE = 6;

function formatDate(date: string): string {
  return date ? date.replace(/-/g, "/") : "";
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

function NewsSkeletonCard() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/40 dark:border-white/[0.08]">
      <Skeleton className="aspect-[772/350] w-full rounded-none" />
      <div className="space-y-2 p-3">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-4 w-full" />
      </div>
    </div>
  );
}

/**
 * 资源页 Today 子页面 → 搜索框下方的 Java 版资讯卡片。
 *
 * 只展示 `newsType` 含 Java 的官方资讯（主进程侧已按 newsType 过滤），
 * 点击卡片用系统浏览器打开原文。
 */
export function JavaNewsSection() {
  const [entries, setEntries] = useState<NewsEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const result = await getNews({ newsType: NEWS_TYPE, limit: PAGE_SIZE, refresh });
      setEntries(result.entries);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="mt-8 w-full max-w-[860px]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Newspaper className="h-4 w-4 text-muted-foreground/70" />
          <h2 className="text-[14px] font-semibold text-foreground">Java 版资讯</h2>
          <span className="text-[11px] text-muted-foreground/60">来自 Minecraft 官方</span>
        </div>
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={loading}
          aria-label="刷新 Java 版资讯"
          className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground/70
            transition-colors hover:bg-black/[0.04] hover:text-foreground disabled:opacity-40
            dark:hover:bg-white/[0.06]"
        >
          <RefreshCw className={clsx("h-3.5 w-3.5", loading && "animate-spin")} />
        </button>
      </div>

      {loading && entries.length === 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <NewsSkeletonCard key={index} />
          ))}
        </div>
      ) : error ? (
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-dashed border-border/40 py-8 text-[12px] text-muted-foreground dark:border-white/[0.08]">
          <span>资讯加载失败</span>
          <button
            type="button"
            onClick={() => void load(true)}
            className="text-primary/80 transition-colors hover:text-primary"
          >
            重试
          </button>
        </div>
      ) : entries.length === 0 ? (
        <div className="flex items-center justify-center rounded-2xl border border-dashed border-border/40 py-8 text-[12px] text-muted-foreground dark:border-white/[0.08]">
          暂无 Java 版资讯
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => openLink(entry.readMoreLink)}
              className={clsx(
                "group flex flex-col overflow-hidden rounded-2xl border text-left transition-[transform,box-shadow,border-color] duration-250 ease-spring-soft",
                "border-border/40 bg-white/70 backdrop-blur-sm dark:border-white/[0.08] dark:bg-black/30",
                "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md dark:hover:border-primary/40"
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
                    className="h-full w-full object-cover transition-transform duration-400 ease-spring-soft group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Newspaper className="h-7 w-7 text-muted-foreground/30" />
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-1 p-3">
                <span className="text-[11px] text-muted-foreground/70">{formatDate(entry.date)}</span>
                <h3 className="line-clamp-2 text-[13px] font-semibold leading-snug text-foreground">
                  {entry.title}
                </h3>
                <span className="mt-auto inline-flex items-center gap-1 pt-1 text-[11px] text-primary/80 group-hover:text-primary">
                  阅读原文
                  <ExternalLink className="h-3 w-3" />
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
