import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { Button } from "@heroui/react";
import { Plus, Copy, FolderOpen, Play, RefreshCw, Search, Star, Trash2, X } from "lucide-react";
import clsx from "clsx";
import { toast } from "@/lib/toast";
import { useInstanceStore } from "@/stores/instanceStore";
import { useConfigStore } from "@/stores/configStore";
import { useAuthStore } from "@/stores/authStore";
import { useLaunchStore } from "@/stores/launchStore";
import { useConfirmDialogStore } from "@/stores/confirmDialogStore";
import { onInstallComplete, onInstallError, onInstallProgress, openPath, repairInstance, updateInstance } from "@/api/instance";
import { InstanceIcon } from "./InstanceIcon";
import { InstanceDetail } from "./InstanceDetail";
import { CreateDialog } from "./CreateDialog";
import type { InstanceInfo } from "@/api/instance";

type SortKey = "recent" | "name" | "playtime" | "created";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "recent", label: "最近游玩" },
  { key: "name", label: "名称" },
  { key: "playtime", label: "时长" },
  { key: "created", label: "创建时间" },
];

const ALL_CATEGORIES = "__all__";

/** 把时间戳格式化成「x 分钟前 / x 天前 / 日期」 */
function formatPlayed(timestamp?: number): string {
  if (!timestamp) return "从未启动";
  const diff = Date.now() - timestamp;
  if (diff < 60_000) return "刚刚";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} 天前`;
  const date = new Date(timestamp);
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

/** 实例的加载器展示文本 */
function loaderLabel(instance: InstanceInfo): string {
  if (instance.launch.loaderLabels.length > 0) return instance.launch.loaderLabels.join(" + ");
  return "原版";
}

export function InstancePage() {
  const instances = useInstanceStore((state) => state.instances);
  const loading = useInstanceStore((state) => state.loading);
  const error = useInstanceStore((state) => state.error);
  const fetchInstances = useInstanceStore((state) => state.fetchInstances);
  const remove = useInstanceStore((state) => state.remove);
  const icons = useInstanceStore((state) => state.icons);
  const loadIcon = useInstanceStore((state) => state.loadIcon);
  const gameConfig = useConfigStore((state) => state.config.game);
  const user = useAuthStore((state) => state.user);
  const openConfirm = useConfirmDialogStore((state) => state.openDialog);
  const launch = useLaunchStore((state) => state.launch);
  const launching = useLaunchStore((state) => state.launching);

  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [category, setCategory] = useState<string>(ALL_CATEGORIES);
  const [createOpen, setCreateOpen] = useState(false);
  const [repairing, setRepairing] = useState(false);
  /** 右键菜单（跟随鼠标位置） */
  const [menu, setMenu] = useState<{ x: number; y: number; name: string } | null>(null);

  const gamePath = gameConfig.gameDir;

  // 安装 / 修复进度（全局事件）：完成或失败后刷新列表
  useEffect(() => {
    const offProgress = onInstallProgress((data) => {
      if (data.channel !== "repair") return;
      toast.loading(data.message || `修复中 ${data.current}/${data.total}`, { id: "instance-repair" });
    });
    const offComplete = onInstallComplete((data) => {
      if (data.channel !== "repair") return;
      toast.dismiss("instance-repair");
      setRepairing(false);
      toast.success("修复完成");
      void fetchInstances(gamePath);
    });
    const offError = onInstallError((data) => {
      if (data.channel !== "repair") return;
      toast.dismiss("instance-repair");
      setRepairing(false);
      toast.error(`修复失败：${data.error}`);
    });
    return () => {
      offProgress();
      offComplete();
      offError();
    };
  }, [fetchInstances, gamePath]);

  useEffect(() => {
    void fetchInstances(gamePath);
  }, [fetchInstances, gamePath]);

  // 逐个加载图标
  useEffect(() => {
    for (const instance of instances) {
      void loadIcon(instance.name, gamePath);
    }
  }, [instances, loadIcon, gamePath]);

  // 选中项保持有效
  useEffect(() => {
    if (instances.length === 0) {
      setSelectedName(null);
      return;
    }
    if (!selectedName || !instances.some((item) => item.name === selectedName)) {
      setSelectedName(instances[0].name);
    }
  }, [instances, selectedName]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const instance of instances) {
      const value = instance.config.category?.trim();
      if (value) set.add(value);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "zh-CN"));
  }, [instances]);

  const visible = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const filtered = instances.filter((instance) => {
      if (favoritesOnly && !instance.config.favorite) return false;
      const value = instance.config.category?.trim() || "";
      if (category !== ALL_CATEGORIES && value !== category) return false;
      if (!keyword) return true;
      const haystack = [
        instance.name,
        instance.config.description || "",
        value,
        instance.config.runtime.minecraft,
        instance.config.runtime.forge || "",
        instance.config.runtime.fabricLoader || "",
        instance.config.runtime.quiltLoader || "",
        instance.config.runtime.neoForged || "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(keyword);
    });

    filtered.sort((a, b) => {
      switch (sort) {
        case "name":
          return (a.config.description || a.name).localeCompare(b.config.description || b.name, "zh-CN");
        case "playtime":
          return (b.config.playtime || 0) - (a.config.playtime || 0);
        case "created":
          return (b.config.creationDate || 0) - (a.config.creationDate || 0);
        default:
          return (b.config.lastPlayedDate || 0) - (a.config.lastPlayedDate || 0);
      }
    });
    return filtered;
  }, [instances, query, favoritesOnly, category, sort]);

  const selected = instances.find((item) => item.name === selectedName) ?? null;

  const refresh = useCallback(async () => {
    await fetchInstances(gamePath);
    const latest = useInstanceStore.getState().instances;
    await Promise.all(latest.map((instance) => loadIcon(instance.name, gamePath, true)));
  }, [fetchInstances, loadIcon, gamePath]);

  const toggleFavorite = useCallback(
    async (instance: InstanceInfo) => {
      try {
        await updateInstance(instance.name, gamePath, { favorite: !instance.config.favorite });
        await refresh();
      } catch (e) {
        toast.error(`切换收藏失败：${e instanceof Error ? e.message : String(e)}`);
      }
    },
    [gamePath, refresh]
  );

  const play = useCallback(
    async (instance: InstanceInfo) => {
      if (!user?.username || !user?.uuid) {
        toast.warning("请先在设置中登录账号");
        return;
      }
      try {
        await launch(instance.name, gamePath);
        const launchError = useLaunchStore.getState().error;
        if (launchError) toast.error(`启动失败：${launchError}`);
        else toast.success("游戏已启动");
      } catch (e) {
        toast.error(`启动失败：${e instanceof Error ? e.message : String(e)}`);
      }
    },
    [gamePath, launch, user]
  );

  const handleRepair = useCallback(
    async (instance: InstanceInfo) => {
      setRepairing(true);
      try {
        await repairInstance(instance.name, gamePath);
      } catch (e) {
        setRepairing(false);
        toast.error(`修复失败：${e instanceof Error ? e.message : String(e)}`);
      }
    },
    [gamePath]
  );

  const handleDelete = useCallback(
    (instance: InstanceInfo) => {
      openConfirm({
        title: "删除实例",
        description: `确定删除「${instance.config.description || instance.name}」吗？实例目录下所有文件都会被删除，且无法恢复。`,
        confirmLabel: "删除",
        countdown: 5,
        onConfirm: async () => {
          try {
            await remove(instance.name, gamePath);
            toast.success("实例已删除");
          } catch (e) {
            toast.error(`删除失败：${e instanceof Error ? e.message : String(e)}`);
          }
        },
      });
    },
    [gamePath, openConfirm, remove]
  );

  return (
    <div className="flex h-full min-h-0">
      {/* 左栏：版本列表 */}
      <aside className="flex w-[292px] shrink-0 flex-col border-r border-border/40 dark:border-white/[0.06]">
        <div className="space-y-2 px-3 pt-3">
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索版本、加载器"
                className="h-8 w-full rounded-lg border border-border/40 bg-white/60 pl-8 pr-7 text-[12px] text-foreground placeholder:text-muted-foreground/50 focus:border-primary/40 dark:border-white/[0.08] dark:bg-black/30"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground"
                  aria-label="清空搜索"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Button
              size="sm"
              variant="ghost"
              onPress={() => void refresh()}
              isDisabled={loading}
              className="h-8 w-8 min-w-0 p-0"
              aria-label="刷新"
            >
              <RefreshCw className={clsx("h-3.5 w-3.5", loading && "animate-spin")} />
            </Button>
            <Button size="sm" onPress={() => setCreateOpen(true)} className="h-8 min-w-0 px-2" aria-label="新建实例">
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* 排序 + 收藏 + 分类 */}
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scroll-area">
            {SORT_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setSort(option.key)}
                className={clsx(
                  "shrink-0 rounded-md px-1.5 py-1 text-[11px] transition-colors",
                  sort === option.key ? "bg-foreground/[0.07] text-foreground dark:bg-white/[0.08]" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {option.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setFavoritesOnly((value) => !value)}
              className={clsx(
                "shrink-0 rounded-md p-1 transition-colors",
                favoritesOnly ? "text-amber-500" : "text-muted-foreground hover:text-foreground"
              )}
              aria-label="只看收藏"
              title="只看收藏"
            >
              <Star className={clsx("h-3.5 w-3.5", favoritesOnly && "fill-current")} />
            </button>
            {categories.length > 0 && (
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="h-6 shrink-0 rounded-md border border-border/40 bg-transparent px-1 text-[11px] text-muted-foreground dark:border-white/[0.08]"
                aria-label="分类筛选"
              >
                <option value={ALL_CATEGORIES}>全部分类</option>
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* 列表 */}
        <div className="scroll-area mt-2 min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-3">
          {loading && visible.length === 0 && (
            <div className="space-y-1.5 px-1">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-[52px] animate-pulse rounded-xl bg-foreground/[0.04] dark:bg-white/[0.04]" />
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="px-2 py-6 text-center">
              <p className="text-[12px] text-destructive">加载失败</p>
              <p className="mt-1 text-[11px] text-muted-foreground/70">{error}</p>
              <Button size="sm" variant="ghost" className="mt-2" onPress={() => void refresh()}>
                重试
              </Button>
            </div>
          )}

          {!loading && !error && visible.length === 0 && (
            <div className="px-2 py-8 text-center">
              <p className="text-[12px] text-muted-foreground">{instances.length === 0 ? "还没有实例" : "没有匹配的实例"}</p>
              {instances.length === 0 ? (
                <Button size="sm" className="mt-3" onPress={() => setCreateOpen(true)}>
                  <Plus className="h-3.5 w-3.5" />
                  新建实例
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-3"
                  onPress={() => {
                    setQuery("");
                    setFavoritesOnly(false);
                    setCategory(ALL_CATEGORIES);
                  }}
                >
                  清除筛选
                </Button>
              )}
            </div>
          )}

          {visible.map((instance) => {
            const active = instance.name === selectedName;
            return (
              <button
                key={instance.name}
                type="button"
                onClick={() => setSelectedName(instance.name)}
                onContextMenu={(event) => {
                  event.preventDefault();
                  setSelectedName(instance.name);
                  setMenu({ x: event.clientX, y: event.clientY, name: instance.name });
                }}
                className={clsx(
                  "flex w-full items-center gap-2.5 rounded-xl border px-2 py-2 text-left transition-[transform,box-shadow,border-color,background-color] duration-200 ease-spring-soft",
                  "hover:-translate-y-0.5 hover:shadow-md",
                  active
                    ? "border-primary/40 bg-primary/[0.08]"
                    : "border-transparent hover:bg-foreground/[0.04] dark:hover:bg-white/[0.04]"
                )}
              >
                <InstanceIcon name={instance.name} icon={icons[instance.name]} className="h-9 w-9" iconClassName="h-1/2 w-1/2" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <span className="truncate text-[13px] font-medium text-foreground">
                      {instance.config.description || instance.name}
                    </span>
                    {instance.config.favorite && <Star className="h-3 w-3 shrink-0 fill-current text-amber-500" />}
                    {!instance.healthy && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" title="文件不完整" />}
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground/70">
                    <span className="shrink-0">{instance.config.runtime.minecraft}</span>
                    <span className="text-muted-foreground/30">·</span>
                    <span className="truncate">{loaderLabel(instance)}</span>
                    <span className="ml-auto shrink-0">{formatPlayed(instance.config.lastPlayedDate)}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="border-t border-border/30 px-3 py-2 text-[11px] text-muted-foreground/60 dark:border-white/[0.04]">
          共 {instances.length} 个实例 · 单击选择，右侧操作
        </div>
      </aside>

      {/* 右栏：详情 */}
      <section className="min-w-0 flex-1">
        {selected ? (
          <InstanceDetail
            key={selected.name}
            instance={selected}
            icon={icons[selected.name]}
            gamePath={gamePath}
            launching={launching}
            repairing={repairing}
            onPlay={() => void play(selected)}
            onRepair={() => void handleRepair(selected)}
            onDelete={() => handleDelete(selected)}
            onChanged={() => void refresh()}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <p className="text-sm text-muted-foreground">选择左侧的实例查看详情</p>
            <p className="text-[12px] text-muted-foreground/60">或新建一个实例开始游戏</p>
          </div>
        )}
      </section>

      <CreateDialog
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(name) => {
          void refresh();
          setSelectedName(name);
        }}
      />

      {/* 列表右键菜单（对齐 PCL：打开目录 / 编辑 / 收藏 / 删除） */}
      {menu &&
        (() => {
          const target = instances.find((item) => item.name === menu.name);
          if (!target) return null;
          const left = Math.min(menu.x, (window.innerWidth || 1200) - 200);
          const top = Math.min(menu.y, (window.innerHeight || 800) - 220);
          const items: { label: string; icon: typeof Play; danger?: boolean; action: () => void }[] = [
            { label: "启动游戏", icon: Play, action: () => void play(target) },
            { label: "打开目录", icon: FolderOpen, action: () => void openPath(target.path) },
            {
              label: "复制实例 ID",
              icon: Copy,
              action: () =>
                void navigator.clipboard
                  .writeText(target.name)
                  .then(() => toast.success("已复制实例 ID"))
                  .catch(() => toast.error("复制失败")),
            },
            {
              label: target.config.favorite ? "取消收藏" : "收藏",
              icon: Star,
              action: () => void toggleFavorite(target),
            },
            { label: "删除实例", icon: Trash2, danger: true, action: () => handleDelete(target) },
          ];
          return (
            <div
              className="fixed inset-0 z-[60]"
              onClick={() => setMenu(null)}
              onContextMenu={(event) => {
                event.preventDefault();
                setMenu(null);
              }}
            >
              <div
                className="absolute w-44 origin-pointer animate-menu-in overflow-hidden rounded-xl border border-border/50 bg-background/95 py-1 shadow-xl backdrop-blur-sm dark:border-white/[0.08]"
                style={{ left, top, "--origin-x": "0%", "--origin-y": "0%" } as CSSProperties}
                onClick={(event) => event.stopPropagation()}
              >
                {items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => {
                        setMenu(null);
                        item.action();
                      }}
                      className={clsx(
                        "flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] transition-colors hover:bg-foreground/[0.06] dark:hover:bg-white/[0.08]",
                        item.danger ? "text-destructive" : "text-foreground"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}
    </div>
  );
}
