//  __         __     __   __     ______     __  __     ______        __   __     ______     ______
// /\ \       /\ \   /\ "-.\ \   /\  ___\   /\ \/ /    /\  ___\      /\ "-.\ \   /\  ___\   /\__  _\
// \ \ \____  \ \ \  \ \ \-.  \  \ \ \__ \  \ \  _"-.  \ \  __\      \ \ \-.  \  \ \  __\   \/_/\ \/
//  \ \_____\  \ \_\  \ \_\\"\_\  \ \_____\  \ \_\ \_\  \ \_____\     \ \_\\"\_\  \ \_____\    \ \_\
//   \/_____/   \/_/   \/_/ \/_/   \/_____/   \/_/\/_/   \/_____/      \/_/ \/_/   \/_____/     \/_/
//
// 所有权利归Lingke Network (china)所有 | dream_pep拥有其艺术改变权力
// 未经允许的情况下删除此版权头可能会受到民事指控
// 请勿在未经Lingke Network (china)允许的范围内修改代码并分发

import { Button } from "@heroui/react";
import { Play, Loader2, FolderOpen, Star, Layers, Clock, AlertTriangle } from "lucide-react";
import clsx from "clsx";
import type { InstanceIconInfo, InstanceInfo } from "@/api/instance";
import { InstanceIcon } from "./InstanceIcon";

const LOADER_META: Record<string, { label: string; className: string }> = {
  vanilla: {
    label: "原版",
    className: "bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400 border-green-500/20",
  },
  forge: {
    label: "Forge",
    className: "bg-orange-500/10 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400 border-orange-500/20",
  },
  fabric: {
    label: "Fabric",
    className: "bg-sky-500/10 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400 border-sky-500/20",
  },
  quilt: {
    label: "Quilt",
    className: "bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400 border-indigo-500/20",
  },
  neoforged: {
    label: "NeoForge",
    className: "bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400 border-red-500/20",
  },
};

function getLoader(runtime: InstanceInfo["config"]["runtime"]): string {
  if (runtime.forge) return "forge";
  if (runtime.fabricLoader) return "fabric";
  if (runtime.quiltLoader) return "quilt";
  if (runtime.neoForged) return "neoforged";
  return "vanilla";
}

function formatPlaytime(ms: number): string {
  if (!ms || ms < 60000) return "0 分钟";
  const hours = Math.floor(ms / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  if (hours > 0) return `${hours} 小时 ${mins} 分`;
  return `${mins} 分钟`;
}

function formatLastPlayed(ts: number): string {
  if (!ts) return "从未";
  const diff = Date.now() - ts;
  const day = 86400000;
  if (diff < 3600000) return "刚刚";
  if (diff < day) return `${Math.floor(diff / 3600000)} 小时前`;
  if (diff < day * 30) return `${Math.floor(diff / day)} 天前`;
  return new Date(ts).toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
}

export interface InstanceCardProps {
  instance: InstanceInfo;
  /** 实例图标（未加载时为 undefined，显示默认图标） */
  icon?: InstanceIconInfo | null;
  /** 该实例是否正在启动/运行 */
  isLaunching?: boolean;
  /** 该实例是否正在修复 */
  isRepairing?: boolean;
  /** 点击卡片主体：打开详情 */
  onOpen: () => void;
  /** 启动游戏 */
  onPlay: () => void;
  /** 打开实例目录 */
  onOpenFolder: () => void;
  /** 切换收藏 */
  onToggleFavorite: () => void;
}

export function InstanceCard({
  instance,
  icon,
  isLaunching = false,
  isRepairing = false,
  onOpen,
  onPlay,
  onOpenFolder,
  onToggleFavorite,
}: InstanceCardProps) {
  const { config } = instance;
  const loader = getLoader(config.runtime);
  const loaderMeta = LOADER_META[loader] ?? LOADER_META.vanilla;
  const display = config.description || config.name || instance.name;
  const blocked = !!instance.dependency && !instance.dependency.ready;
  const favorite = !!config.favorite;
  const category = config.category?.trim();

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      className={clsx(
        "group relative flex flex-col rounded-2xl p-4 text-left cursor-pointer",
        "border border-black/[0.06] dark:border-white/[0.07]",
        "bg-white/70 dark:bg-black/30 backdrop-blur-sm",
        "transition-all duration-200 hover:border-primary/35 hover:shadow-lg hover:shadow-black/[0.06] dark:hover:shadow-black/30",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      )}
    >
      {/* 收藏 */}
      <button
        type="button"
        aria-label={favorite ? "取消收藏" : "收藏"}
        title={favorite ? "取消收藏" : "收藏"}
        onClick={(event) => {
          event.stopPropagation();
          onToggleFavorite();
        }}
        className={clsx(
          "absolute top-3 right-3 w-7 h-7 rounded-lg flex items-center justify-center transition-colors",
          favorite
            ? "text-amber-500 bg-amber-500/10"
            : "text-muted-foreground/40 opacity-0 group-hover:opacity-100 hover:text-amber-500 hover:bg-amber-500/10"
        )}
      >
        <Star className={clsx("w-4 h-4", favorite && "fill-current")} />
      </button>

      {/* 图标 + 名称 */}
      <div className="flex items-start gap-3 min-w-0">
        <InstanceIcon
          name={instance.name}
          icon={icon}
          className="w-14 h-14 rounded-2xl"
        />
        <div className="min-w-0 flex-1 pr-7">
          <p className="text-[14px] font-semibold text-foreground truncate">{display}</p>
          <p className="text-[11px] text-muted-foreground/70 truncate mt-0.5 font-mono">{instance.name}</p>
          <div className="flex items-center gap-1.5 flex-wrap mt-2">
            <span className={clsx("text-[10px] px-1.5 py-0.5 rounded-md border font-medium", loaderMeta.className)}>
              {loaderMeta.label}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-foreground/[0.05] dark:bg-white/[0.06] text-muted-foreground border border-border/30 dark:border-white/[0.05]">
              {config.runtime.minecraft || "未知版本"}
            </span>
            {blocked ? (
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-destructive/10 text-destructive border border-destructive/20">
                依赖缺失
              </span>
            ) : (
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400 border border-green-500/20">
                可启动
              </span>
            )}
            {category && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 max-w-[7rem] truncate">
                {category}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 统计 */}
      <div className="mt-3.5 flex items-center gap-4 text-[11px] text-muted-foreground/80">
        <span className="flex items-center gap-1">
          <Layers className="w-3.5 h-3.5" />
          {instance.modCount} 模组
        </span>
        <span className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" />
          {formatPlaytime(config.playtime || 0)}
        </span>
        <span className="ml-auto text-muted-foreground/60">{formatLastPlayed(config.lastPlayedDate || 0)}</span>
      </div>

      {blocked && instance.dependency && (
        <div className="mt-3 flex items-start gap-1.5 text-[11px] text-amber-600 dark:text-amber-400">
          <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" />
          <span className="min-w-0">
            缺少 {instance.dependency.missingLibraries} 个依赖库
            {instance.dependency.missingVersions.length > 0 ? "，启动版本不完整" : ""}，进详情可修复
          </span>
        </div>
      )}

      {/* 操作 */}
      <div className="mt-3.5 flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
        <Button
          size="sm"
          className="flex-1 min-w-0"
          isDisabled={isLaunching || isRepairing || blocked}
          onPress={onPlay}
        >
          {isLaunching ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              启动中
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5" />
              启动
            </>
          )}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="min-w-0 w-8 h-8 p-0"
          aria-label="打开实例目录"
          onPress={onOpenFolder}
        >
          <FolderOpen className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
