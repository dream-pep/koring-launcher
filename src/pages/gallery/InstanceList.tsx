//  __         __     __   __     ______     __  __     ______        __   __     ______     ______
// /\ \       /\ \   /\ "-.\ \   /\  ___\   /\ \/ /    /\  ___\      /\ "-.\ \   /\  ___\   /\__  _\
// \ \ \____  \ \ \  \ \ \-.  \  \ \ \__ \  \ \  _"-.  \ \  __\      \ \ \-.  \  \ \  __\   \/_/\ \/
//  \ \_____\  \ \_\  \ \_\\"\_\  \ \_____\  \ \_\ \_\  \ \_____\     \ \_\\"\_\  \ \_____\    \ \_\
//   \/_____/   \/_/   \/_/ \/_/   \/_____/   \/_/\/_/   \/_____/      \/_/ \/_/   \/_____/     \/_/
//
// 所有权利归Lingke Network (china)所有 | dream_pep拥有其艺术改变权力
// 未经允许的情况下删除此版权头可能会受到民事指控
// 请勿在未经Lingke Network (china)允许的范围内修改代码并分发

import clsx from "clsx";
import { Gamepad2, FolderOpen } from "lucide-react";
import type { InstanceInfo } from "@/api/instance";
import { Skeleton } from "@/components/ui/skeleton";

// 加载器颜色映射（顶部色条）
const loaderColors: Record<string, string> = {
  vanilla: "bg-green-400",
  forge: "bg-orange-400",
  fabric: "bg-sky-400",
  quilt: "bg-indigo-400",
  neoforged: "bg-red-400",
};

// 从运行环境推断加载器类型
function getLoader(runtime: InstanceInfo["config"]["runtime"]): string {
  if (runtime.forge) return "forge";
  if (runtime.fabricLoader) return "fabric";
  if (runtime.quiltLoader) return "quilt";
  if (runtime.neoForged) return "neoforged";
  return "vanilla";
}

interface InstanceListProps {
  instances: InstanceInfo[];
  selectedName: string | null;
  loading: boolean;
  onSelect: (name: string) => void;
}

export function InstanceList({ instances, selectedName, loading, onSelect }: InstanceListProps) {
  return (
    <div className="flex flex-col gap-2 min-w-0">
      {loading && instances.length === 0
        ? Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border/30 dark:border-white/[0.06] p-3 space-y-2">
              <div className="flex items-center gap-2.5">
                <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-2.5 w-1/2" />
                </div>
              </div>
            </div>
          ))
        : instances.map((inst) => {
            const active = inst.name === selectedName;
            const loader = getLoader(inst.config.runtime);
            const topColor = loaderColors[loader] ?? loaderColors.vanilla;
            const display = inst.config.description || inst.name;

            return (
              <button
                key={inst.name}
                onClick={() => onSelect(inst.name)}
                className={clsx(
                  "group relative text-left rounded-xl transition-all duration-150 overflow-hidden cursor-pointer",
                  "border",
                  active
                    ? "border-primary/40 bg-primary/[0.06] dark:bg-primary/[0.08] shadow-sm"
                    : "border-border/40 dark:border-white/[0.07] bg-white/70 dark:bg-black/35 hover:border-primary/25 hover:bg-foreground/[0.02]",
                )}
              >
                <div className={clsx("absolute left-0 top-0 bottom-0 w-1", topColor)} />
                <div className="flex items-center gap-2.5 px-3 py-2.5 pl-4">
                  <div
                    className={clsx(
                      "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                      loader === "vanilla"
                        ? "bg-green-500/10 text-green-600 dark:text-green-400"
                        : "bg-foreground/[0.05] dark:bg-white/[0.06] text-muted-foreground",
                    )}
                  >
                    <Gamepad2 className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={clsx("text-[13px] font-medium truncate", active ? "text-primary" : "text-foreground")}>
                      {display}
                    </p>
                    <p className="text-[11px] text-muted-foreground/70 truncate">
                      {inst.config.runtime.minecraft || "未知版本"}
                      {inst.modCount > 0 ? ` · ${inst.modCount} 模组` : ""}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}

      {!loading && instances.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <FolderOpen className="w-7 h-7 text-muted-foreground/30" />
          <p className="text-[12px] text-muted-foreground/70">暂无实例，点击右上角新建</p>
        </div>
      )}
    </div>
  );
}
