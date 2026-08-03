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
import {
  Play,
  Pencil,
  FolderOpen,
  Trash2,
  Loader2,
  Gamepad2,
  Layers,
  ImageIcon,
  Save,
  Clock,
  CalendarDays,
} from "lucide-react";
import clsx from "clsx";
import type { InstanceInfo } from "@/api/instance";

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

function getLoader(runtime: InstanceInfo["config"]["runtime"]): string {
  if (runtime.forge) return "forge";
  if (runtime.fabricLoader) return "fabric";
  if (runtime.quiltLoader) return "quilt";
  if (runtime.neoForged) return "neoforged";
  return "vanilla";
}

function formatDate(ts: number): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function formatPlaytime(ms: number): string {
  if (!ms || ms < 60000) return "0 分钟";
  const hours = Math.floor(ms / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  if (hours > 0) return `${hours} 小时 ${mins} 分钟`;
  return `${mins} 分钟`;
}

interface InstanceDetailProps {
  instance: InstanceInfo;
  isLaunching: boolean;
  onPlay: () => void;
  onEdit: () => void;
  onOpenFolder: () => void;
  onDelete: () => void;
}

export function InstanceDetail({ instance, isLaunching, onPlay, onEdit, onOpenFolder, onDelete }: InstanceDetailProps) {
  const { config } = instance;
  const loader = getLoader(config.runtime);
  const badgeCls = loaderBadgeColors[loader] ?? loaderBadgeColors.vanilla;
  const loaderLabel = loaderLabels[loader] ?? loader;
  const display = config.description || config.name || instance.name;

  // 统计卡片数据
  const stats = [
    { label: "模组", value: instance.modCount, icon: Layers },
    { label: "资源包", value: instance.resourcePackCount, icon: ImageIcon },
    { label: "存档", value: instance.saveCount, icon: Save },
    { label: "截图", value: instance.screenshotCount, icon: Gamepad2 },
  ];

  return (
    <div className="rounded-2xl overflow-hidden bg-white/85 dark:bg-black/45 border border-black/[0.06] dark:border-white/[0.07]">
      {/* 头部横幅 */}
      <div className="relative px-6 pt-7 pb-5 bg-gradient-to-br from-primary/[0.08] via-transparent to-transparent dark:from-primary/[0.12]">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-foreground/[0.05] dark:bg-white/[0.06] flex items-center justify-center shrink-0">
                <Gamepad2 className="w-7 h-7 text-primary/70" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-foreground truncate">{display}</h2>
                <p className="text-[12px] text-muted-foreground/70 truncate mt-0.5 font-mono">{instance.name}</p>
              </div>
            </div>

            {/* 版本 / 加载器 / 健康状态 */}
            <div className="flex items-center gap-1.5 flex-wrap mt-3.5">
              <span className={clsx("text-[11px] px-2 py-0.5 rounded-md border font-medium", badgeCls)}>
                {loaderLabel}
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-foreground/[0.05] dark:bg-white/[0.05] text-muted-foreground border border-border/30 dark:border-white/[0.05]">
                Minecraft {config.runtime.minecraft || "未知"}
              </span>
              {instance.healthy ? (
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400 border border-green-500/20">
                  健康
                </span>
              ) : (
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-destructive/10 text-destructive border border-destructive/20">
                  异常（{instance.issues.length} 项）
                </span>
              )}
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="ghost"
              className="min-w-0 w-8 h-8 p-0"
              onPress={onEdit}
              aria-label="编辑实例"
            >
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="min-w-0 w-8 h-8 p-0"
              onPress={onOpenFolder}
              aria-label="打开游戏目录"
            >
              <FolderOpen className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="sm"
              variant="danger"
              className="min-w-0 w-8 h-8 p-0"
              onPress={onDelete}
              aria-label="删除实例"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="px-6 pb-6 space-y-5">
        {/* 统计网格 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-border/30 dark:border-white/[0.06] bg-foreground/[0.02] dark:bg-white/[0.02] px-3.5 py-3 flex items-center gap-3"
            >
              <s.icon className="w-4 h-4 text-muted-foreground/50 shrink-0" />
              <div className="min-w-0">
                <p className="text-lg font-bold text-foreground leading-none">{s.value}</p>
                <p className="text-[11px] text-muted-foreground/70 mt-1">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* 基本信息 */}
        <div className="rounded-xl border border-border/30 dark:border-white/[0.06] divide-y divide-border/30 dark:divide-white/[0.05]">
          <InfoRow icon={CalendarDays} label="创建时间" value={formatDate(config.creationDate)} />
          <InfoRow icon={Clock} label="最近游玩" value={formatDate(config.lastPlayedDate)} />
          <InfoRow icon={Gamepad2} label="累计时长" value={formatPlaytime(config.playtime)} />
          <InfoRow
            icon={Layers}
            label="内存分配"
            value={config.minMemory || config.maxMemory ? `${config.minMemory || 1024} MB - ${config.maxMemory || 4096} MB` : "默认（自动）"}
          />
        </div>

        {/* 启动按钮 */}
        <Button
          className="w-full h-11"
          variant="primary"
          onPress={onPlay}
          isDisabled={isLaunching}
        >
          {isLaunching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
          {isLaunching ? "正在启动..." : "启动游戏"}
        </Button>
      </div>
    </div>
  );
}

// 信息行（图标 + 标签 + 值）
function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <Icon className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
      <span className="text-[12px] text-muted-foreground w-20 shrink-0">{label}</span>
      <span className="text-[12px] text-foreground/90 truncate">{value}</span>
    </div>
  );
}
