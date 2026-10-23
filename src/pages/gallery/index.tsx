//  __         __     __   __     ______     __  __     ______        __   __     ______     ______
// /\ \       /\ \   /\ "-.\ \   /\  ___\   /\ \/ /    /\  ___\      /\ "-.\ \   /\  ___\   /\__  _\
// \ \ \____  \ \ \  \ \ \-.  \  \ \ \__ \  \ \  _"-.  \ \  __\      \ \ \-.  \  \ \  __\   \/_/\ \/
//  \ \_____\  \ \_\  \ \_\\"\_\  \ \_____\  \ \_\ \_\  \ \_____\     \ \_\\"\_\  \ \_____\    \ \_\
//   \/_____/   \/_/   \/_/ \/_/   \/_____/   \/_/\/_/   \/_____/      \/_/ \/_/   \/_____/     \/_/
//
// 所有权利归Lingke Network (china)所有 | dream_pep拥有其艺术改变权力
// 未经允许的情况下删除此版权头可能会受到民事指控
// 请勿在未经Lingke Network (china)允许的范围内修改代码并分发

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@heroui/react";
import { Plus, RefreshCw, Gamepad2, Search, Star, ArrowLeft, X } from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";
import { useInstanceStore } from "@/stores/instanceStore";
import { useConfigStore } from "@/stores/configStore";
import { useAuthStore } from "@/stores/authStore";
import { useLaunchStore } from "@/stores/launchStore";
import { useConfirmDialogStore } from "@/stores/confirmDialogStore";
import { openPath } from "@/api/system";
import { repairInstance, onInstallProgress, onInstallComplete, onInstallError, type InstanceRuntime } from "@/api/instance";
import { Input } from "@/components/ui/input";
import { InstanceCard } from "./InstanceCard";
import { InstanceDetail } from "./InstanceDetail";
import { EditDialog } from "./EditDialog";
import { CreateDialog } from "./CreateDialog";

type SortKey = "recent" | "name" | "playtime" | "created";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "recent", label: "最近游玩" },
  { key: "name", label: "按名称" },
  { key: "playtime", label: "游玩时长" },
  { key: "created", label: "创建时间" },
];

const ALL_CATEGORIES = "__all__";
const NO_CATEGORY = "__none__";

export function Gallery() {
  const instances = useInstanceStore((s) => s.instances);
  const loading = useInstanceStore((s) => s.loading);
  const fetchInstances = useInstanceStore((s) => s.fetchInstances);
  const remove = useInstanceStore((s) => s.remove);
  const create = useInstanceStore((s) => s.create);
  const icons = useInstanceStore((s) => s.icons);
  const loadIcon = useInstanceStore((s) => s.loadIcon);
  const gameConfig = useConfigStore((s) => s.config.game);
  const configInstances = useConfigStore((s) => s.config.instances);
  const setInstances = useConfigStore((s) => s.setInstances);
  const user = useAuthStore((s) => s.user);
  const openConfirm = useConfirmDialogStore((s) => s.openDialog);
  const launch = useLaunchStore((s) => s.launch);
  const launching = useLaunchStore((s) => s.launching);

  const [selectedName, setSelectedName] = useState<string | null>(null);
  /** grid = 卡片网格；detail = 单个实例详情 */
  const [view, setView] = useState<"grid" | "detail">("grid");
  const [editOpen, setEditOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [query, setQuery] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>(ALL_CATEGORIES);
  const [sort, setSort] = useState<SortKey>("recent");

  // 修复实例：进度与结果通过 instance:progress / instance:install-complete 推送
  useEffect(() => {
    const offProgress = onInstallProgress((data) => {
      if (data.channel !== "repair") return;
      toast.loading(data.message || `修复中 ${data.current}/${data.total}`, { id: "repair-progress" });
    });
    const offComplete = onInstallComplete((data) => {
      if (data.channel !== "repair") return;
      toast.dismiss("repair-progress");
      setRepairing(false);
      toast.success("实例修复完成");
      void fetchInstances(gameConfig.gameDir);
    });
    const offError = onInstallError((data) => {
      if (data.channel !== "repair") return;
      toast.dismiss("repair-progress");
      setRepairing(false);
      toast.error(`修复失败: ${data.error}`);
    });
    return () => {
      offProgress();
      offComplete();
      offError();
    };
  }, [fetchInstances, gameConfig.gameDir]);

  // 新建实例：直接在实例页完成（创建后还需要「修复/安装」下载游戏文件）
  const openCreateInstance = useCallback(() => {
    setCreateOpen(true);
  }, []);

  const handleCreateInstance = useCallback(
    async (name: string, runtime: InstanceRuntime, displayName?: string) => {
      await create(name, gameConfig.gameDir, runtime, { description: displayName });
      await fetchInstances(gameConfig.gameDir);
      setSelectedName(name);
      setView("grid");
      toast.success(`实例「${displayName || name}」已创建`, {
        description: "实例还没有游戏文件，点开详情用「修复」或安装来下载对应版本",
      });
    },
    [create, fetchInstances, gameConfig.gameDir],
  );

  // 加载实例列表
  const loadInstances = useCallback(async () => {
    await fetchInstances(gameConfig.gameDir);
  }, [fetchInstances, gameConfig.gameDir]);

  // 手动刷新：列表与图标都重新读取（外部往实例目录放进 logo.png 后点刷新即可看到）
  const refreshAll = useCallback(async () => {
    await fetchInstances(gameConfig.gameDir);
    const latest = useInstanceStore.getState().instances;
    await Promise.all(latest.map((instance) => loadIcon(instance.name, gameConfig.gameDir, true)));
  }, [fetchInstances, loadIcon, gameConfig.gameDir]);

  useEffect(() => {
    loadInstances();
  }, [loadInstances]);

  // 逐个加载实例图标（实例目录里的 logo.png；没有则显示默认图标）
  useEffect(() => {
    for (const instance of instances) {
      void loadIcon(instance.name, gameConfig.gameDir);
    }
  }, [instances, loadIcon, gameConfig.gameDir]);

  // 分类标签（来自各实例的 category 字段）
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const instance of instances) {
      const category = instance.config.category?.trim();
      if (category) set.add(category);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "zh-CN"));
  }, [instances]);

  const uncategorizedCount = useMemo(
    () => instances.filter((instance) => !instance.config.category?.trim()).length,
    [instances]
  );

  // 搜索 + 收藏 + 分类筛选 + 排序
  const visibleInstances = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const filtered = instances.filter((instance) => {
      const category = instance.config.category?.trim() || "";
      if (favoritesOnly && !instance.config.favorite) return false;
      if (categoryFilter === NO_CATEGORY && category) return false;
      if (categoryFilter !== ALL_CATEGORIES && categoryFilter !== NO_CATEGORY && category !== categoryFilter) {
        return false;
      }
      if (!keyword) return true;
      const haystack = [
        instance.name,
        instance.config.description || "",
        category,
        instance.config.runtime.minecraft || "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(keyword);
    });

    filtered.sort((a, b) => {
      switch (sort) {
        case "name": {
          const left = a.config.description || a.name;
          const right = b.config.description || b.name;
          return left.localeCompare(right, "zh-CN");
        }
        case "playtime":
          return (b.config.playtime || 0) - (a.config.playtime || 0);
        case "created":
          return (b.config.creationDate || 0) - (a.config.creationDate || 0);
        default:
          return (
            (b.config.lastPlayedDate || 0) - (a.config.lastPlayedDate || 0) ||
            (b.config.lastAccessDate || 0) - (a.config.lastAccessDate || 0)
          );
      }
    });
    return filtered;
  }, [instances, query, favoritesOnly, categoryFilter, sort]);

  const selected = instances.find((i) => i.name === selectedName) ?? null;

  // 默认进入详情时保持选中项有效
  useEffect(() => {
    if (!selectedName && instances.length > 0) {
      setSelectedName(instances[0].name);
    }
    if (selectedName && !instances.some((i) => i.name === selectedName)) {
      setSelectedName(instances[0]?.name ?? null);
    }
  }, [instances, selectedName]);

  const openDetail = (name: string) => {
    setSelectedName(name);
    setView("detail");
  };

  // 启动游戏（统一接口：主进程自动应用权威配置）
  const playInstance = async (name: string) => {
    if (!user?.username || !user?.uuid) {
      toast.warning("请先在设置中登录账号");
      return;
    }
    try {
      await launch(name, gameConfig.gameDir);
      const error = useLaunchStore.getState().error;
      if (error) {
        toast.error(`启动失败: ${error}`);
      } else {
        toast.success("游戏已启动");
      }
    } catch (e: any) {
      toast.error(`启动失败: ${e.message || e}`);
    }
  };

  const handlePlay = async () => {
    if (!selected) return;
    await playInstance(selected.name);
  };

  // 打开实例目录
  const openInstanceFolder = async (targetPath: string) => {
    const result = await openPath(targetPath);
    if (!result.success) {
      toast.error(`无法打开目录: ${result.error || "未知错误"}`);
    }
  };

  // 收藏 / 取消收藏
  const toggleFavorite = async (name: string, favorite: boolean) => {
    const updated = await useInstanceStore
      .getState()
      .updateMeta(name, gameConfig.gameDir, { favorite: !favorite });
    if (!updated) {
      toast.error("收藏状态保存失败");
    }
  };

  // 删除实例（带确认）
  const handleDelete = () => {
    if (!selected) return;
    const target = selected;
    openConfirm({
      title: "删除实例",
      description: `确定要删除实例「${target.config.description || target.name}」吗？该操作将删除实例目录下所有文件，且无法恢复。`,
      confirmLabel: "删除",
      countdown: 5,
      onConfirm: async () => {
        try {
          await remove(target.name, gameConfig.gameDir);
          // 同步移除 Koring.yml 中的记录
          setInstances(configInstances.filter((m) => m.name !== target.name));
          setSelectedName(null);
          setView("grid");
          toast.success("实例已删除");
        } catch (e: any) {
          toast.error(`删除失败: ${e.message || e}`);
        }
      },
    });
  };

  // 编辑实例（显示名 / 分类 / 内存）
  const handleEditSave = async (patch: {
    description?: string;
    category?: string;
    minMemory?: number;
    maxMemory?: number;
  }) => {
    if (!selected) return;
    const name = selected.name;
    const updated = await useInstanceStore.getState().updateMeta(name, gameConfig.gameDir, patch);
    if (!updated) {
      toast.error("保存失败");
      return;
    }
    // 同步 config 里的显示名
    if (patch.description !== undefined) {
      setInstances(
        configInstances.map((m) =>
          m.name === name ? { ...m, displayName: patch.description?.trim() || m.displayName } : m
        )
      );
    }
    toast.success("实例设置已保存");
  };

  // 图标变更后立即反映到卡片/详情
  const handleIconChanged = (name: string) => {
    void loadIcon(name, gameConfig.gameDir, true);
    void fetchInstances(gameConfig.gameDir);
  };

  // 修复实例（补齐版本 JSON / JAR / 依赖库 / 资源索引）
  const handleRepair = async () => {
    if (!selected) return;
    setRepairing(true);
    try {
      await repairInstance(selected.name, gameConfig.gameDir);
    } catch (e: any) {
      setRepairing(false);
      toast.error(`修复失败: ${e?.message || e}`);
    }
  };

  const filtersActive = favoritesOnly || categoryFilter !== ALL_CATEGORIES || query.trim().length > 0;

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50 pointer-events-none" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索实例名称、分类或版本"
          className="pl-8 h-8 text-[13px]"
        />
        {query && (
          <button
            type="button"
            aria-label="清空搜索"
            onClick={() => setQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* 收藏筛选 */}
      <button
        type="button"
        onClick={() => setFavoritesOnly((prev) => !prev)}
        title="只看收藏"
        className={clsx(
          "h-8 px-2.5 rounded-lg border text-[12px] flex items-center gap-1 transition-colors",
          favoritesOnly
            ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
            : "border-border/40 dark:border-white/[0.08] text-muted-foreground hover:text-foreground"
        )}
      >
        <Star className={clsx("w-3.5 h-3.5", favoritesOnly && "fill-current")} />
        收藏
      </button>

      {/* 分类筛选 */}
      <div className="flex items-center gap-1 flex-wrap">
        <button
          type="button"
          onClick={() => setCategoryFilter(ALL_CATEGORIES)}
          className={clsx(
            "h-8 px-2.5 rounded-lg border text-[12px] transition-colors",
            categoryFilter === ALL_CATEGORIES
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-border/40 dark:border-white/[0.08] text-muted-foreground hover:text-foreground"
          )}
        >
          全部（{instances.length}）
        </button>
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => setCategoryFilter(category)}
            className={clsx(
              "h-8 px-2.5 rounded-lg border text-[12px] max-w-[9rem] truncate transition-colors",
              categoryFilter === category
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border/40 dark:border-white/[0.08] text-muted-foreground hover:text-foreground"
            )}
          >
            {category}
          </button>
        ))}
        {uncategorizedCount > 0 && (
          <button
            type="button"
            onClick={() => setCategoryFilter(NO_CATEGORY)}
            className={clsx(
              "h-8 px-2.5 rounded-lg border text-[12px] transition-colors",
              categoryFilter === NO_CATEGORY
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border/40 dark:border-white/[0.08] text-muted-foreground hover:text-foreground"
            )}
          >
            未分类（{uncategorizedCount}）
          </button>
        )}
      </div>

      {/* 排序 */}
      <div className="flex items-center gap-1 ml-auto">
        {SORT_OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => setSort(option.key)}
            className={clsx(
              "h-8 px-2.5 rounded-lg text-[12px] transition-colors",
              sort === option.key
                ? "bg-foreground/[0.07] dark:bg-white/[0.08] text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="p-6 h-full overflow-y-auto scroll-area">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-4">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-foreground">实例管理</h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            创建、管理和启动 Minecraft 实例
            {filtersActive && !loading ? `（筛选出 ${visibleInstances.length} / ${instances.length}）` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="ghost"
            onPress={refreshAll}
            isDisabled={loading}
            className="min-w-0 w-8 h-8 p-0"
            aria-label="刷新实例列表"
          >
            <RefreshCw className={clsx("w-4 h-4", loading && "animate-spin")} />
          </Button>
          <Button size="sm" onPress={openCreateInstance}>
            <Plus className="w-4 h-4" />
            新建实例
          </Button>
        </div>
      </div>

      {instances.length > 0 && toolbar}

      {view === "detail" && selected ? (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setView("grid")}
            className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            返回实例列表
          </button>
          <InstanceDetail
            instance={selected}
            icon={icons[selected.name]}
            isLaunching={launching}
            isRepairing={repairing}
            onPlay={handlePlay}
            onEdit={() => setEditOpen(true)}
            onOpenFolder={() => openInstanceFolder(selected.path)}
            onDelete={handleDelete}
            onRepair={handleRepair}
          />
        </div>
      ) : instances.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-24 rounded-2xl border border-dashed border-border/40 dark:border-white/[0.08]">
          <div className="w-16 h-16 rounded-full bg-foreground/[0.04] dark:bg-white/[0.04] flex items-center justify-center">
            <Gamepad2 className="w-8 h-8 text-muted-foreground/30" />
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">{loading ? "正在加载实例..." : "还没有任何实例"}</p>
            {!loading && (
              <p className="text-[12px] text-muted-foreground/60 mt-1">
                点击「新建实例」创建你的第一个游戏实例
              </p>
            )}
          </div>
          {!loading && (
            <Button size="sm" onPress={openCreateInstance}>
              <Plus className="w-4 h-4" />
              新建实例
            </Button>
          )}
        </div>
      ) : visibleInstances.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 rounded-2xl border border-dashed border-border/40 dark:border-white/[0.08]">
          <Search className="w-6 h-6 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">没有符合条件的实例</p>
          <Button
            size="sm"
            variant="ghost"
            onPress={() => {
              setQuery("");
              setFavoritesOnly(false);
              setCategoryFilter(ALL_CATEGORIES);
            }}
          >
            清除筛选
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {visibleInstances.map((instance) => (
            <InstanceCard
              key={instance.name}
              instance={instance}
              icon={icons[instance.name]}
              isLaunching={launching}
              isRepairing={repairing && selectedName === instance.name}
              onOpen={() => openDetail(instance.name)}
              onPlay={() => playInstance(instance.name)}
              onOpenFolder={() => openInstanceFolder(instance.path)}
              onToggleFavorite={() => toggleFavorite(instance.name, !!instance.config.favorite)}
            />
          ))}
        </div>
      )}

      <EditDialog
        instance={selected}
        gamePath={gameConfig.gameDir}
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        onSave={handleEditSave}
        onIconChanged={() => selected && handleIconChanged(selected.name)}
      />

      <CreateDialog
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={handleCreateInstance}
      />
    </div>
  );
}
