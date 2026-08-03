//  __         __     __   __     ______     __  __     ______        __   __     ______     ______
// /\ \       /\ \   /\ "-.\ \   /\  ___\   /\ \/ /    /\  ___\      /\ "-.\ \   /\  ___\   /\__  _\
// \ \ \____  \ \ \  \ \ \-.  \  \ \ \__ \  \ \  _"-.  \ \  __\      \ \ \-.  \  \ \  __\   \/_/\ \/
//  \ \_____\  \ \_\  \ \_\\"\_\  \ \_____\  \ \_\ \_\  \ \_____\     \ \_\\"\_\  \ \_____\    \ \_\
//   \/_____/   \/_/   \/_/ \/_/   \/_____/   \/_/\/_/   \/_____/      \/_/ \/_/   \/_____/     \/_/
//
// 所有权利归Lingke Network (china)所有 | dream_pep拥有其艺术改变权力
// 未经允许的情况下删除此版权头可能会受到民事指控
// 请勿在未经Lingke Network (china)允许的范围内修改代码并分发

import { Box, Puzzle, Package } from "lucide-react";
import clsx from "clsx";

// 侧边栏分类类型
export type StoreSection = "game" | "mod" | "modpack";

const iconCls = "w-[18px] h-[18px] shrink-0";

interface SidebarProps {
  section: StoreSection;
  onSelect: (section: StoreSection) => void;
}

export function Sidebar({ section, onSelect }: SidebarProps) {
  return (
    <aside className="scroll-area w-[220px] shrink-0 h-full overflow-y-auto py-5 pl-4 pr-2">
      <nav className="space-y-6">
        {/* 原版游戏（独立入口） */}
        <div>
          <div className="space-y-0.5">
            <SidebarItem
              active={section === "game"}
              icon={<Box className={iconCls} />}
              label="原版游戏"
              onClick={() => onSelect("game")}
            />
          </div>
        </div>

        {/* 社区资源 */}
        <div>
          <div className="mx-3 mb-3 border-t border-border/40" />
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-foreground/40 mb-2 px-3">
            社区资源
          </h3>
          <div className="space-y-0.5">
            <SidebarItem
              active={section === "mod"}
              icon={<Puzzle className={iconCls} />}
              label="MOD"
              onClick={() => onSelect("mod")}
            />
            <SidebarItem
              active={section === "modpack"}
              icon={<Package className={iconCls} />}
              label="整合包"
              onClick={() => onSelect("modpack")}
            />
          </div>
        </div>
      </nav>
    </aside>
  );
}

// 单个侧边栏项（样式与设置页一致）
function SidebarItem({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "relative w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-[13.5px] transition-all duration-150",
        active ? "text-foreground font-medium" : "text-foreground/50 hover:text-foreground/80 hover:bg-foreground/[0.04]",
      )}
    >
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[16px] rounded-full bg-primary" />
      )}
      <span className={active ? "text-foreground/80" : "text-foreground/35"}>{icon}</span>
      {label}
    </button>
  );
}
