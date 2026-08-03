//  __         __     __   __     ______     __  __     ______        __   __     ______     ______
// /\ \       /\ \   /\ "-.\ \   /\  ___\   /\ \/ /    /\  ___\      /\ "-.\ \   /\  ___\   /\__  _\
// \ \ \____  \ \ \  \ \ \-.  \  \ \ \__ \  \ \  _"-.  \ \  __\      \ \ \-.  \  \ \  __\   \/_/\ \/
//  \ \_____\  \ \_\  \ \_\\"\_\  \ \_____\  \ \_\ \_\  \ \_____\     \ \_\\"\_\  \ \_____\    \ \_\
//   \/_____/   \/_/   \/_/ \/_/   \/_____/   \/_/\/_/   \/_____/      \/_/ \/_/   \/_____/     \/_/
//
// 所有权利归Lingke Network (china)所有 | dream_pep拥有其艺术改变权力
// 未经允许的情况下删除此版权头可能会受到民事指控
// 请勿在未经Lingke Network (china)允许的范围内修改代码并分发

import { Download, Package, ChevronRight } from "lucide-react";
import type { ModSearchResult } from "@/api/mods";

// 格式化下载量（如 1234567 -> 123.4万）
function formatDownloads(count: number): string {
  if (count >= 100000000) return `${(count / 100000000).toFixed(1)}亿`;
  if (count >= 10000) return `${(count / 10000).toFixed(1)}万`;
  return String(count);
}

interface ModCardProps {
  mod: ModSearchResult;
  /** 操作按钮文字（MOD：安装 / 整合包：查看） */
  actionLabel?: string;
  onOpen: (mod: ModSearchResult) => void;
}

// 横条式资源行（一行一个）：左侧图标 + 中间信息 + 右侧操作
export function ModCard({ mod, actionLabel = "安装", onOpen }: ModCardProps) {
  return (
    <div
      className="group relative flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-150
        bg-white/85 dark:bg-black/45
        border border-black/[0.06] dark:border-white/[0.07]
        hover:shadow-md hover:border-primary/25 dark:hover:border-primary/25
        cursor-pointer"
      onClick={() => onOpen(mod)}
    >
      {/* 图标 */}
      <div className="w-12 h-12 rounded-lg overflow-hidden bg-foreground/[0.05] dark:bg-white/[0.05] flex items-center justify-center shrink-0">
        {mod.iconUrl ? (
          <img
            src={mod.iconUrl}
            alt={mod.name}
            loading="lazy"
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <Package className="w-5 h-5 text-muted-foreground/40" />
        )}
      </div>

      {/* 中间信息 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[13.5px] font-semibold text-foreground truncate">{mod.name}</p>
          {mod.categories?.slice(0, 2).map((cat) => (
            <span
              key={cat}
              className="text-[10px] px-1.5 py-0.5 rounded bg-foreground/[0.05] dark:bg-white/[0.05] text-muted-foreground/80 border border-border/30 dark:border-white/[0.05] shrink-0"
            >
              {cat}
            </span>
          ))}
        </div>
        <p className="text-[12px] leading-relaxed text-muted-foreground/70 truncate mt-0.5">
          {mod.description || "暂无描述"}
        </p>
      </div>

      {/* 右侧：下载量 + 操作 */}
      <div className="flex items-center gap-4 shrink-0">
        <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground/70">
          <Download className="w-3.5 h-3.5" />
          {formatDownloads(mod.downloads)}
        </span>
        <span
          className="flex items-center gap-1 px-3.5 h-8 rounded-lg text-[12.5px] font-medium
            bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
        >
          {actionLabel}
          <ChevronRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </div>
  );
}
