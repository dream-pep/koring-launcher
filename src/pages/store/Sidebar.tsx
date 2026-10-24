//  __         __     __   __     ______     __  __     ______        __   __     ______     ______
// /\ \       /\ \   /\ "-.\ \   /\  ___\   /\ \/ /    /\  ___\      /\ "-.\ \   /\  ___\   /\__  _\
// \ \ \____  \ \ \  \ \ \-.  \  \ \ \__ \  \ \  _"-.  \ \  __\      \ \ \-.  \  \ \  __\   \/_/\ \/
//  \ \_____\  \ \_\  \ \_\\"\_\  \ \_____\  \ \_\ \_\  \ \_____\     \ \_\\"\_\  \ \_____\    \ \_\
//   \/_____/   \/_/   \/_/ \/_/   \/_____/   \/_/\/_/   \/_____/      \/_/ \/_/   \/_____/     \/_/
//
// 所有权利归Lingke Network (china)所有 | dream_pep拥有其艺术改变权力
// 未经允许的情况下删除此版权头可能会受到民事指控
// 请勿在未经Lingke Network (china)允许的范围内修改代码并分发

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
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
  const navRef = useRef<HTMLElement | null>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [indicatorTop, setIndicatorTop] = useState(0);

  // 选中指示条按实际 DOM 位置测量，随条目一起 spring 滑动
  const updateIndicator = useCallback(() => {
    const nav = navRef.current;
    const button = itemRefs.current[section];
    if (!nav || !button) return;
    const navRect = nav.getBoundingClientRect();
    const rect = button.getBoundingClientRect();
    setIndicatorTop(rect.top - navRect.top + rect.height / 2 - 8);
  }, [section]);

  useLayoutEffect(() => {
    updateIndicator();
  }, [updateIndicator]);

  useEffect(() => {
    window.addEventListener("resize", updateIndicator);
    const nav = navRef.current;
    let observer: ResizeObserver | null = null;
    if (nav && typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(updateIndicator);
      observer.observe(nav);
    }
    document.fonts?.ready.then(() => updateIndicator()).catch(() => {});
    return () => {
      window.removeEventListener("resize", updateIndicator);
      observer?.disconnect();
    };
  }, [updateIndicator]);

  return (
    <aside className="scroll-area w-[220px] shrink-0 h-full overflow-y-auto py-5 pl-4 pr-2">
      <nav ref={navRef} className="relative space-y-6">
        {/* 单个滑动指示条（与设置页一致） */}
        <span
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 z-10 h-4 w-[3px] rounded-full bg-primary"
          style={{
            transform: `translateY(${indicatorTop}px)`,
            transition: "transform 260ms var(--ease-spring)",
          }}
        />
        {/* 原版游戏（独立入口） */}
        <div>
          <div className="space-y-0.5">
            <SidebarItem
              active={section === "game"}
              icon={<Box className={iconCls} />}
              label="原版游戏"
              onClick={() => onSelect("game")}
              buttonRef={(el) => {
                itemRefs.current.game = el;
              }}
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
              buttonRef={(el) => {
                itemRefs.current.mod = el;
              }}
            />
            <SidebarItem
              active={section === "modpack"}
              icon={<Package className={iconCls} />}
              label="整合包"
              onClick={() => onSelect("modpack")}
              buttonRef={(el) => {
                itemRefs.current.modpack = el;
              }}
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
  buttonRef,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  buttonRef?: (el: HTMLButtonElement | null) => void;
}) {
  return (
    <button
      ref={buttonRef}
      onClick={onClick}
      className={clsx(
        "relative w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-[13.5px] transition-[color,background-color] duration-200 ease-spring-soft active:scale-[0.99]",
        active ? "text-foreground font-medium" : "text-foreground/50 hover:text-foreground/80 hover:bg-foreground/[0.04]",
      )}
    >
      <span className={active ? "text-foreground/80" : "text-foreground/35"}>{icon}</span>
      {label}
    </button>
  );
}
