import { Button } from "@heroui/react";
import {
  Play,
  Settings,
  Clock,
  Gamepad2,
} from "lucide-react";
import clsx from "clsx";
import type { InstanceInfo } from "@/api/instance";

function getLoader(runtime: InstanceInfo["config"]["runtime"]): string {
  if (runtime.forge) return "forge";
  if (runtime.fabricLoader) return "fabric";
  if (runtime.quiltLoader) return "quilt";
  if (runtime.neoForged) return "neoforged";
  return "vanilla";
}

function getLoaderVersion(runtime: InstanceInfo["config"]["runtime"]): string {
  return runtime.forge || runtime.fabricLoader || runtime.quiltLoader || runtime.neoForged || "";
}

const loaderBadgeColors: Record<string, string> = {
  vanilla: "bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400 border-green-500/20",
  forge: "bg-orange-500/10 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400 border-orange-500/20",
  fabric: "bg-sky-500/10 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400 border-sky-500/20",
  quilt: "bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400 border-indigo-500/20",
  neoforged: "bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400 border-red-500/20",
};

const loaderLabels: Record<string, string> = {
  vanilla: "原版",
  forge: "Forge",
  fabric: "Fabric",
  quilt: "Quilt",
  neoforged: "NeoForge",
};

const loaderColors: Record<string, string> = {
  vanilla: "bg-green-400",
  forge: "bg-orange-400",
  fabric: "bg-sky-400",
  quilt: "bg-indigo-400",
  neoforged: "bg-red-400",
};

function formatPlaytime(ms: number): string {
  if (!ms || ms < 60000) return "";
  const hours = Math.floor(ms / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function formatLastPlayed(ts: number): string {
  if (!ts) return "";
  const diff = Date.now() - ts;
  if (diff < 3600000) return "刚刚";
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`;
  return new Date(ts).toLocaleDateString("zh-CN");
}

interface InstanceCardProps {
  instance: InstanceInfo;
  displayName?: string;
  onPlay: (name: string) => void;
  onSettings: (name: string) => void;
  isLaunching: boolean;
}

export function InstanceCard({ instance, displayName, onPlay, onSettings, isLaunching }: InstanceCardProps) {
  const { name, config, modCount, healthy } = instance;
  const loader = getLoader(config.runtime);
  const version = config.runtime.minecraft || "未知";
  const loaderLabel = loaderLabels[loader] ?? loader;
  const badgeCls = loaderBadgeColors[loader] ?? loaderBadgeColors.vanilla;
  const topColor = loaderColors[loader] ?? loaderColors.vanilla;
  const title = displayName || config.name || name;

  return (
    <div
      className={clsx(
        "relative group rounded-xl transition-all duration-200",
        "bg-white/85 dark:bg-black/45",
        "border border-black/[0.06] dark:border-white/[0.07]",
        "hover:shadow-md hover:border-primary/20 dark:hover:border-primary/20",
        "overflow-hidden",
      )}
    >
      <div className={clsx("h-1.5 w-full", topColor)} />

      <div className="px-5 py-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{title}</p>
            <p className="text-[10.5px] text-muted-foreground/60 mt-0.5 truncate">{name}</p>
          </div>
          {healthy === false && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive font-medium shrink-0">
              异常
            </span>
          )}
          <Button
            size="sm"
            variant="light"
            className="min-w-0 w-7 h-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            onPress={() => onSettings(name)}
          >
            <Settings className="w-3.5 h-3.5" />
          </Button>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={clsx("text-[10.5px] px-2 py-0.5 rounded-md border font-medium", badgeCls)}>
            {loaderLabel}
          </span>
          <span className="text-[10.5px] px-2 py-0.5 rounded-md bg-foreground/[0.05] dark:bg-white/[0.05] text-muted-foreground border border-border/30 dark:border-white/[0.05]">
            {version}
          </span>
          {modCount > 0 && (
            <span className="text-[10.5px] px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:bg-purple-500/15 dark:text-purple-400 border border-purple-500/20">
              {modCount} 模组
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-[11px] text-muted-foreground/60">
          {config.lastPlayedDate ? (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />{formatLastPlayed(config.lastPlayedDate)}
            </span>
          ) : null}
          {config.playtime > 0 && (
            <span className="flex items-center gap-1">
              <Gamepad2 className="w-3 h-3" />{formatPlaytime(config.playtime)}
            </span>
          )}
        </div>

        <Button
          size="sm"
          className="w-full"
          variant="flat"
          startContent={<Play className="w-3.5 h-3.5" />}
          onPress={() => onPlay(name)}
          isDisabled={isLaunching}
        >
          启动游戏
        </Button>
      </div>
    </div>
  );
}
