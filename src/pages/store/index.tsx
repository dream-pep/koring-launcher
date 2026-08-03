//  __         __     __   __     ______     __  __     ______        __   __     ______     ______
// /\ \       /\ \   /\ "-.\ \   /\  ___\   /\ \/ /    /\  ___\      /\ "-.\ \   /\  ___\   /\__  _\
// \ \ \____  \ \ \  \ \ \-.  \  \ \ \__ \  \ \  _"-.  \ \  __\      \ \ \-.  \  \ \  __\   \/_/\ \/
//  \ \_____\  \ \_\  \ \_\\"\_\  \ \_____\  \ \_\ \_\  \ \_____\     \ \_\\"\_\  \ \_____\    \ \_\
//   \/_____/   \/_/   \/_/ \/_/   \/_____/   \/_/\/_/   \/_____/      \/_/ \/_/   \/_____/     \/_/
//
// 所有权利归Lingke Network (china)所有 | dream_pep拥有其艺术改变权力
// 未经允许的情况下删除此版权头可能会受到民事指控
// 请勿在未经Lingke Network (china)允许的范围内修改代码并分发

import { useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";
import { useRouteStore } from "@/stores/routeStore";
import { Sidebar } from "./Sidebar";
import { GameVersionView } from "./GameVersionView";
import { ResourceBrowseView } from "./ResourceBrowseView";

export function Store() {
  const section = useRouteStore((s) => s.storeSection);
  const setStoreSection = useRouteStore((s) => s.setStoreSection);

  // 内容区滚动容器
  const mainRef = useRef<HTMLElement | null>(null);
  const [showTop, setShowTop] = useState(false);

  // 监听内容区滚动，非顶部时显示"返回顶部"按钮
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const onScroll = () => setShowTop(el.scrollTop > 300);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = () => {
    mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="flex h-full">
      {/* 左侧边栏（与设置页同款样式） */}
      <Sidebar section={section} onSelect={setStoreSection} />

      {/* 右侧内容区（唯一滚动容器，支持无限滚动与返回顶部） */}
      <main ref={mainRef} className="scroll-area flex-1 h-full min-w-0 overflow-y-auto p-6">
        <div key={section} className="setting-page-enter h-full">
          {section === "game" ? (
            <GameVersionView />
          ) : (
            <ResourceBrowseView
              projectType={section}
              canInstall={section === "mod"}
              scrollRef={mainRef}
            />
          )}
        </div>

        {/* 返回顶部按钮（非顶部时显示） */}
        {showTop && (
          <button
            onClick={scrollToTop}
            aria-label="返回顶部"
            className="fixed bottom-6 right-6 z-50 w-10 h-10 rounded-full
              bg-background/85 backdrop-blur-xl border border-border/50
              shadow-lg shadow-black/10 dark:shadow-black/30
              flex items-center justify-center text-muted-foreground hover:text-foreground
              hover:border-primary/40 transition-all duration-200 cursor-pointer"
          >
            <ArrowUp className="w-4.5 h-4.5" />
          </button>
        )}
      </main>
    </div>
  );
}

// 供外部（实例管理）跳转资源中心分类使用
export type { StoreSection } from "./Sidebar";
