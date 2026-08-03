//  __         __     __   __     ______     __  __     ______        __   __     ______     ______
// /\ \       /\ \   /\ "-.\ \   /\  ___\   /\ \/ /    /\  ___\      /\ "-.\ \   /\  ___\   /\__  _\
// \ \ \____  \ \ \  \ \ \-.  \  \ \ \__ \  \ \  _"-.  \ \  __\      \ \ \-.  \  \ \  __\   \/_/\ \/
//  \ \_____\  \ \_\  \ \_\\"\_\  \ \_____\  \ \_\ \_\  \ \_____\     \ \_\\"\_\  \ \_____\    \ \_\
//   \/_____/   \/_/   \/_/ \/_/   \/_____/   \/_/\/_/   \/_____/      \/_/ \/_/   \/_____/     \/_/
//
// 所有权利归Lingke Network (china)所有 | dream_pep拥有其艺术改变权力
// 未经允许的情况下删除此版权头可能会受到民事指控
// 请勿在未经Lingke Network (china)允许的范围内修改代码并分发

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, ListBox, ListBoxItem, Select, Skeleton } from "@heroui/react";
import { Search, ChevronDown, RotateCcw, Package, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { useModsStore } from "@/stores/modsStore";
import { getCategories, getGameVersions } from "@/api/mods";
import type { ModCategory, ModSearchResult } from "@/api/mods";
import { ModCard } from "./ModCard";
import { ModInstallDialog } from "./ModInstallDialog";

// 加载器筛选选项（对应 Modrinth categories 值）
const LOADER_OPTIONS = [
  { value: "fabric", label: "Fabric" },
  { value: "forge", label: "Forge" },
  { value: "quilt", label: "Quilt" },
  { value: "neoforged", label: "NeoForge" },
];

interface ResourceBrowseViewProps {
  projectType: "mod" | "modpack";
  /** 是否支持安装（整合包暂不支持安装） */
  canInstall: boolean;
  /** 外层滚动容器（用于无限滚动检测） */
  scrollRef: React.RefObject<HTMLElement | null>;
}

export function ResourceBrowseView({ projectType, canInstall, scrollRef }: ResourceBrowseViewProps) {
  const { searchResults, total, hasMore, loading, error, search, clear } = useModsStore();

  // 页面筛选状态
  const [query, setQuery] = useState("");
  const [gameVersion, setGameVersion] = useState<string | undefined>();
  const [loader, setLoader] = useState<string | undefined>();
  const [category, setCategory] = useState<string | undefined>();

  // 筛选选项数据
  const [categories, setCategories] = useState<ModCategory[]>([]);
  const [gameVersions, setGameVersions] = useState<string[]>([]);

  // 安装弹窗
  const [activeMod, setActiveMod] = useState<ModSearchResult | null>(null);
  // 加载更多状态
  const [loadingMore, setLoadingMore] = useState(false);

  // 用 ref 保存最新筛选值，供无限滚动读取（避免闭包过期）
  const filtersRef = useRef({ query, gameVersion, loader, category });
  filtersRef.current = { query, gameVersion, loader, category };
  const projectTypeRef = useRef(projectType);
  projectTypeRef.current = projectType;
  const loadingMoreRef = useRef(false);

  const doSearch = useCallback((params: Parameters<typeof search>[0]) => search(params), [search]);

  // 分类切换：重置筛选与结果
  useEffect(() => {
    clear();
    setQuery("");
    setGameVersion(undefined);
    setLoader(undefined);
    setCategory(undefined);
    setActiveMod(null);
    getCategories(projectType).then(setCategories).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectType]);

  // 初始化游戏版本选项
  useEffect(() => {
    getGameVersions().then(setGameVersions).catch(() => {});
  }, []);

  // 搜索防抖（300ms），筛选变化时回到第一页
  useEffect(() => {
    const timer = setTimeout(() => {
      doSearch({ query, gameVersion, loader, category, projectType: projectTypeRef.current, page: 1 });
    }, 300);
    return () => clearTimeout(timer);
  }, [query, gameVersion, loader, category, doSearch]);

  // 无限滚动：滚动到底部附近时加载下一页
  const loadMore = useCallback(() => {
    const state = useModsStore.getState();
    if (!state.hasMore || loadingMoreRef.current || state.loading) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    const f = filtersRef.current;
    state
      .search({
        query: f.query,
        gameVersion: f.gameVersion,
        loader: f.loader,
        category: f.category,
        projectType: projectTypeRef.current,
        page: state.currentPage + 1,
        append: true,
      })
      .finally(() => {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      });
  }, []);

  useEffect(() => {
    const el = scrollRef?.current;
    if (!el) return;
    const onScroll = () => {
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 300) loadMore();
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [scrollRef, loadMore]);

  const hasFilter = Boolean(query || gameVersion || loader || category);

  // 重置全部筛选
  const handleReset = () => {
    setQuery("");
    setGameVersion(undefined);
    setLoader(undefined);
    setCategory(undefined);
  };

  // Select 选项变化处理（RAC Selection 转为值）
  const handleSelectChange = (setter: (v: string | undefined) => void) => (keys: unknown) => {
    const set = keys as Set<string>;
    const value = set.size > 0 ? Array.from(set)[0] : "all";
    setter(value === "all" ? undefined : value);
  };

  // 卡片点击：MOD 打开安装弹窗；整合包暂不支持安装
  const handleCardOpen = (mod: ModSearchResult) => {
    if (canInstall) {
      setActiveMod(mod);
    } else {
      toast.info("整合包安装功能开发中，敬请期待");
    }
  };

  const title = projectType === "mod" ? "MOD" : "整合包";
  const description = projectType === "mod"
    ? "从 Modrinth 搜索 Mod，一键安装到你的实例"
    : "浏览社区整合包（安装功能开发中）";

  return (
    <div className="min-h-full">
      {/* 页头：标题 + 搜索框 */}
      <div className="flex items-center justify-between gap-4 mb-5">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-foreground">{title}</h1>
          <p className="text-[13px] text-muted-foreground mt-1">{description}</p>
        </div>
        <div className="relative w-72 shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
          <Input
            className="h-9 pl-9 pr-3 rounded-xl"
            placeholder={`搜索${title}...`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {/* 筛选区：游戏版本 / 加载器 / 分类 */}
      <div className="flex items-center gap-2.5 flex-wrap mb-5">
        <Select.Root
          selectedKey={gameVersion ?? "all"}
          onSelectionChange={handleSelectChange(setGameVersion)}
          size="sm"
          className="w-40"
        >
          <Select.Trigger className="h-8 rounded-lg border border-border/40 dark:border-white/[0.08] bg-white/60 dark:bg-black/30 px-3 hover:border-primary/30 transition-colors">
            <Select.Value className="text-[13px] text-foreground">
              {gameVersion ? `Minecraft ${gameVersion}` : "全部版本"}
            </Select.Value>
            <Select.Indicator>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            </Select.Indicator>
          </Select.Trigger>
          <Select.Popover className="z-50 rounded-xl border border-border/50 dark:border-white/[0.08] bg-background shadow-xl p-1.5 w-44">
            <ListBox className="max-h-72 overflow-y-auto scroll-area outline-none">
              <ListBoxItem id="all" className="text-[13px] py-1.5 px-2.5 rounded-lg data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary outline-none cursor-pointer">
                全部版本
              </ListBoxItem>
              {gameVersions.slice(0, 30).map((v) => (
                <ListBoxItem key={v} id={v} className="text-[13px] py-1.5 px-2.5 rounded-lg data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary outline-none cursor-pointer">
                  {v}
                </ListBoxItem>
              ))}
            </ListBox>
          </Select.Popover>
        </Select.Root>

        <Select.Root
          selectedKey={loader ?? "all"}
          onSelectionChange={handleSelectChange(setLoader)}
          size="sm"
          className="w-36"
        >
          <Select.Trigger className="h-8 rounded-lg border border-border/40 dark:border-white/[0.08] bg-white/60 dark:bg-black/30 px-3 hover:border-primary/30 transition-colors">
            <Select.Value className="text-[13px] text-foreground">
              {loader ? LOADER_OPTIONS.find((o) => o.value === loader)?.label ?? loader : "全部加载器"}
            </Select.Value>
            <Select.Indicator>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            </Select.Indicator>
          </Select.Trigger>
          <Select.Popover className="z-50 rounded-xl border border-border/50 dark:border-white/[0.08] bg-background shadow-xl p-1.5 w-40">
            <ListBox className="outline-none">
              <ListBoxItem id="all" className="text-[13px] py-1.5 px-2.5 rounded-lg data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary outline-none cursor-pointer">
                全部加载器
              </ListBoxItem>
              {LOADER_OPTIONS.map((o) => (
                <ListBoxItem key={o.value} id={o.value} className="text-[13px] py-1.5 px-2.5 rounded-lg data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary outline-none cursor-pointer">
                  {o.label}
                </ListBoxItem>
              ))}
            </ListBox>
          </Select.Popover>
        </Select.Root>

        <Select.Root
          selectedKey={category ?? "all"}
          onSelectionChange={handleSelectChange(setCategory)}
          size="sm"
          className="w-40"
        >
          <Select.Trigger className="h-8 rounded-lg border border-border/40 dark:border-white/[0.08] bg-white/60 dark:bg-black/30 px-3 hover:border-primary/30 transition-colors">
            <Select.Value className="text-[13px] text-foreground">
              {category ? categories.find((c) => c.name === category)?.label ?? category : "全部分类"}
            </Select.Value>
            <Select.Indicator>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            </Select.Indicator>
          </Select.Trigger>
          <Select.Popover className="z-50 rounded-xl border border-border/50 dark:border-white/[0.08] bg-background shadow-xl p-1.5 w-44">
            <ListBox className="max-h-72 overflow-y-auto scroll-area outline-none">
              <ListBoxItem id="all" className="text-[13px] py-1.5 px-2.5 rounded-lg data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary outline-none cursor-pointer">
                全部分类
              </ListBoxItem>
              {categories.map((c) => (
                <ListBoxItem key={c.name} id={c.name} className="text-[13px] py-1.5 px-2.5 rounded-lg data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary outline-none cursor-pointer">
                  {c.label}
                </ListBoxItem>
              ))}
            </ListBox>
          </Select.Popover>
        </Select.Root>

        {/* 结果计数 + 重置 */}
        <span className="text-[12px] text-muted-foreground/70 ml-1">
          共 {total} 个结果
        </span>
        {hasFilter && (
          <Button size="sm" variant="ghost" className="h-8 min-w-0" onPress={handleReset}>
            <RotateCcw className="w-3.5 h-3.5" />
            重置筛选
          </Button>
        )}
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 mb-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-[13px]">
          <XCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1 min-w-0">搜索失败：{error}</span>
          <button
            className="text-[12px] underline underline-offset-2 shrink-0"
            onClick={() => doSearch({ query, gameVersion, loader, category, projectType: projectTypeRef.current, page: 1 })}
          >
            重试
          </button>
        </div>
      )}

      {/* 列表（无限滚动拼接，一行一条横条） */}
      {loading && searchResults.length === 0 ? (
        <div className="flex flex-col gap-2.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 rounded-xl border border-border/30 dark:border-white/[0.06] p-3">
              <Skeleton className="w-12 h-12 rounded-lg shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-1/3" />
                <Skeleton className="h-3 w-2/3" />
              </div>
              <Skeleton className="h-8 w-20 rounded-lg shrink-0" />
            </div>
          ))}
        </div>
      ) : !loading && searchResults.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-24">
          <div className="w-16 h-16 rounded-full bg-foreground/[0.04] dark:bg-white/[0.04] flex items-center justify-center">
            <Package className="w-8 h-8 text-muted-foreground/30" />
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">{hasFilter ? "没有找到匹配的资源" : "暂无资源"}</p>
            <p className="text-[12px] text-muted-foreground/60 mt-1">
              {hasFilter ? "尝试调整搜索关键词或筛选条件" : "搜索你想要的资源"}
            </p>
          </div>
          {hasFilter && (
            <Button size="sm" variant="secondary" onPress={handleReset}>
              重置筛选
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2.5">
            {searchResults.map((mod) => (
              <ModCard
                key={mod.id}
                mod={mod}
                actionLabel={canInstall ? "安装" : "查看"}
                onOpen={handleCardOpen}
              />
            ))}
          </div>

          {/* 底部加载状态 */}
          <div className="flex items-center justify-center py-8 text-[13px] text-muted-foreground/60">
            {loadingMore ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                加载更多...
              </span>
            ) : !hasMore && searchResults.length > 0 ? (
              <span>已经到底啦</span>
            ) : null}
          </div>
        </>
      )}

      {/* 安装弹窗（仅 MOD） */}
      {canInstall && (
        <ModInstallDialog
          mod={activeMod}
          gameVersion={gameVersion}
          loader={loader}
          onClose={() => setActiveMod(null)}
        />
      )}
    </div>
  );
}
