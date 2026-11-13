import {
  Fragment,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import { ScrollShadow } from "@/components/ui/scroll-shadow";

/** 侧边栏中的一个条目 */
export interface PageShellItem {
  /** 唯一 key，同时作为子页保活缓存的标识 */
  key: string;
  label: string;
  /** 条目图标（建议 18px，交给调用方控制尺寸） */
  icon?: ReactNode;
  /**
   * 第二行副标题（如目录路径），单行截断；过长时鼠标悬停显示全文。
   * 不传时条目保持单行。
   */
  description?: ReactNode;
  /** 条目对应的子页内容；动作条目不需要 */
  content?: ReactNode;
  /** 动作条目：点击后只执行回调，不切换子页、不参与选中态 */
  onSelect?: () => void;
  /**
   * 条目右键菜单内容（通常是 <ContextMenuContent>…</ContextMenuContent>）。
   * 提供后条目可右键唤出菜单；不传则保持普通按钮。
   */
  contextMenu?: ReactNode;
  /**
   * 不在侧边栏列出（仍可被外部切换显示其子页，例如由自定义入口打开的页面）。
   * 子页内容与切换动画照常工作。
   */
  hidden?: boolean;
  /**
   * 子页滚动阴影：不传 = 不加阴影（默认）；"end" = 只在底部渐变；"both" = 上下都有。
   * 只有确实需要「下面还有内容」提示的长页面才开。
   */
  scrollShadow?: "end" | "both";
}

/** 侧边栏分组（分组之间自动画分隔线） */
export interface PageShellGroup {
  title?: string;
  items: PageShellItem[];
}

export interface PageShellProps {
  /** 侧边栏分组数据 */
  groups: PageShellGroup[];
  /** 受控选中 key（与 onValueChange 搭配使用） */
  value?: string;
  /** 非受控时的初始选中 key（默认第一个可切换条目） */
  defaultValue?: string;
  /** 选中项变化回调 */
  onValueChange?: (key: string) => void;
  /** 侧边栏宽度（px），默认 220 */
  sidebarWidth?: number;
  /** 侧边栏顶部插槽（搜索框、标题、按钮组等） */
  sidebarHeader?: ReactNode;
  /** 侧边栏底部插槽 */
  sidebarFooter?: ReactNode;
  /** 没有任何条目时侧边栏的内容；不传则不渲染侧边栏 */
  sidebarEmpty?: ReactNode;
  sidebarClassName?: string;
  contentClassName?: string;
  /** 每个子页容器的额外 class（默认 p-8，会与默认值合并） */
  pageClassName?: string;
  /** 侧边栏 nav 的无障碍名称 */
  navLabel?: string;
  /** 是否保活已访问过的子页（默认 true） */
  keepAlive?: boolean;
  className?: string;
}

type PageDir = "up" | "down";

interface PageTransition {
  /** 正在退出的子页 key */
  from: string;
  /** down = 选中更靠下的条目，新页从下方进入；up = 反方向 */
  dir: PageDir;
}

interface PageShellContextValue {
  /** 当前选中的条目 key */
  activeKey: string;
  /** 从内容区里跳转到另一个条目 */
  navigate: (key: string) => void;
}

const PageShellContext = createContext<PageShellContextValue | null>(null);

/**
 * 在子页内容里反向操作侧边栏（例如「主页」子页里的跳转按钮）。
 * 必须在 <PageShell> 渲染的子树内使用。
 */
export function usePageShellNav(): PageShellContextValue {
  const ctx = useContext(PageShellContext);
  if (!ctx) throw new Error("usePageShellNav() 必须在 <PageShell> 内使用");
  return ctx;
}

/**
 * 页面外壳：左侧分组导航 + 右侧子页内容区。
 *
 * 从设置页抽出的标准化结构，设置页与实例页共用：
 * - 侧边栏选中项由一条指示条滑动标记（按真实 DOM 位置测量）；
 * - 子页切换方向由条目在侧边栏中的上下顺序决定（去更靠下的条目 → 新页从下方进入）；
 * - 已访问子页保活缓存，切换时不卸载，子页内部的滚动位置/表单状态得以保留；
 * - 支持受控（value + onValueChange）与非受控（defaultValue）两种用法；
 * - 带 onSelect 的条目视为动作项（如「开发者选项」跳转其它页面），不参与选中与内容切换。
 */
export function PageShell({
  groups,
  value,
  defaultValue,
  onValueChange,
  sidebarWidth = 220,
  sidebarHeader,
  sidebarFooter,
  sidebarEmpty,
  sidebarClassName,
  contentClassName,
  pageClassName = "p-8",
  navLabel = "页面导航",
  keepAlive = true,
  className,
}: PageShellProps) {
  // 侧边栏只列出非 hidden 条目；hidden 条目仍参与子页渲染与切换（内容不受影响）
  const sidebarGroups = groups
    .map((group) => ({ ...group, items: group.items.filter((item) => !item.hidden) }))
    .filter((group) => group.items.length > 0);
  const items = groups.flatMap((group) => group.items);
  // 可切换条目的顺序：决定子页切换方向（动作项没有子页，不参与）
  const switchableItems = items.filter((item) => !item.onSelect);
  const firstKey = (switchableItems.find((item) => !item.hidden) ?? switchableItems[0])?.key;

  // 非受控 / 受控两种用法
  const isControlled = value !== undefined;
  const [innerValue, setInnerValue] = useState(defaultValue ?? "");
  const selected = isControlled ? value : innerValue || firstKey || "";
  const hasActive = switchableItems.some((item) => item.key === selected);

  const [transition, setTransition] = useState<PageTransition | null>(null);
  // 已访问子页缓存（keep-alive）：隐藏页不卸载，避免重挂载带来的请求/动画开销
  const [visited, setVisited] = useState<Record<string, boolean>>(() => {
    const initial = value ?? defaultValue ?? firstKey;
    return initial ? { [initial]: true } : {};
  });

  const transitionTimer = useRef<number | undefined>(undefined);
  const prevSelected = useRef(selected);
  const orderRef = useRef<string[]>(switchableItems.map((item) => item.key));
  orderRef.current = switchableItems.map((item) => item.key);

  // 选择变化时统一处理：标记访问、计算方向、播放进出场动画（受控/非受控同一套逻辑）
  useLayoutEffect(() => {
    const from = prevSelected.current;
    if (from === selected) return;
    prevSelected.current = selected;

    const order = orderRef.current;
    const fromIndex = order.indexOf(from);
    const toIndex = order.indexOf(selected);
    // 侧边栏是纵向列表：去更靠下的条目，新页从下方进入、旧页向上退出；反之镜像。
    // 这样「从哪来到哪去」由用户点击的位置决定，而不是固定的左进右出。
    const dir: PageDir = toIndex >= fromIndex ? "down" : "up";

    setVisited((prev) => (prev[selected] ? prev : { ...prev, [selected]: true }));
    setTransition({ from, dir });
    window.clearTimeout(transitionTimer.current);
    // 旧页 220ms 渐出 + 新页 60ms 延迟后 360ms 渐入，留一点余量再清理过渡状态
    transitionTimer.current = window.setTimeout(() => setTransition(null), 460);
  }, [selected]);

  // 卸载时清掉切换定时器，避免对已卸载组件 setState
  useEffect(() => () => window.clearTimeout(transitionTimer.current), []);

  const navigate = useCallback(
    (key: string) => {
      if (key === selected) return;
      if (!isControlled) setInnerValue(key);
      onValueChange?.(key);
    },
    [selected, isControlled, onValueChange],
  );

  // 侧栏选中指示条：按实际 DOM 位置测量（分组/动作项变化都能跟随）
  const navRef = useRef<HTMLElement | null>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [indicatorTop, setIndicatorTop] = useState(0);

  const updateIndicator = useCallback(() => {
    const nav = navRef.current;
    const button = itemRefs.current[selected];
    if (!nav || !button) return;
    const navRect = nav.getBoundingClientRect();
    const rect = button.getBoundingClientRect();
    const next = rect.top - navRect.top + rect.height / 2 - 8;
    setIndicatorTop((prev) => (prev === next ? prev : next));
  }, [selected]);

  // 每次渲染后测量一次：分组/动作项、字体、窗口尺寸都会改变条目位置
  useLayoutEffect(() => {
    updateIndicator();
  });

  useEffect(() => {
    window.addEventListener("resize", updateIndicator);
    // 字体加载（Alimama/Inter）或侧栏内容变化会改变条目高度，需要重新测量指示条位置
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

  const handleItemClick = (item: PageShellItem) => {
    if (item.onSelect) item.onSelect();
    else navigate(item.key);
  };

  // 只有带内容的条目才需要子页容器；keep-alive 时渲染所有访问过的，否则只渲染当前页
  const pages = switchableItems.filter(
    (item) => item.content !== undefined && (keepAlive ? visited[item.key] : item.key === selected),
  );

  const showSidebar = sidebarGroups.length > 0 || sidebarEmpty !== undefined;

  return (
    <PageShellContext.Provider value={{ activeKey: selected, navigate }}>
      <div className={cn("flex h-full", className)}>
        {showSidebar && (
          <aside
            className={cn(
              "scroll-area shrink-0 h-full overflow-y-auto py-5 pl-4 pr-2",
              sidebarClassName,
            )}
            style={{ width: sidebarWidth }}
          >
            {sidebarHeader}
            {sidebarGroups.length > 0 ? (
              <nav ref={navRef} aria-label={navLabel} className="relative space-y-6">
                {/* 选中指示条：单个元素在侧栏内滑动（spring），而不是每个条目各弹一条 */}
                {hasActive && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute left-0 top-0 z-10 h-4 w-[3px] rounded-full bg-primary"
                    style={{
                      transform: `translateY(${indicatorTop}px)`,
                      transition: "transform 260ms var(--ease-spring)",
                    }}
                  />
                )}
                {sidebarGroups.map((group, groupIndex) => (
                  <div key={group.title ?? groupIndex}>
                    {groupIndex > 0 && <div className="mx-3 mb-3 border-t border-border/40" />}
                    {group.title && (
                      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-foreground/40 mb-2 px-3">
                        {group.title}
                      </h3>
                    )}
                    <div className="space-y-0.5">
                      {group.items.map((item) => {
                        const active = selected === item.key && !item.onSelect;
                        const button = (
                          <button
                            type="button"
                            ref={(el) => {
                              itemRefs.current[item.key] = el;
                            }}
                            onClick={() => handleItemClick(item)}
                            aria-current={active ? "page" : undefined}
                            title={
                              typeof item.description === "string" ? item.description : item.label
                            }
                            className={cn(
                              "relative w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-[13.5px] transition-[scale,color,background-color] duration-200 ease-spring-soft active:scale-[0.99]",
                              active
                                ? "text-foreground font-medium"
                                : "text-foreground/50 hover:text-foreground/80 hover:bg-foreground/[0.04]",
                            )}
                          >
                            {item.icon && (
                              <span className={active ? "text-foreground/80" : "text-foreground/35"}>
                                {item.icon}
                              </span>
                            )}
                            <span className="flex min-w-0 flex-1 flex-col text-left">
                              <span className="truncate">{item.label}</span>
                              {item.description !== undefined && (
                                <span
                                  className={cn(
                                    "truncate font-mono text-[11px] font-normal",
                                    active ? "text-muted-foreground/80" : "text-muted-foreground/50",
                                  )}
                                >
                                  {item.description}
                                </span>
                              )}
                            </span>
                          </button>
                        );
                        return (
                          <Fragment key={item.key}>
                            {item.contextMenu ? (
                              <ContextMenu>
                                <ContextMenuTrigger render={button} />
                                {item.contextMenu}
                              </ContextMenu>
                            ) : (
                              button
                            )}
                          </Fragment>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </nav>
            ) : (
              sidebarEmpty
            )}
            {sidebarFooter}
          </aside>
        )}

        {/* 内容区（已访问页缓存保活；每个子页独立滚动，切换时新旧页分层叠加做方向性进出场） */}
        <main className={cn("relative flex-1 h-full overflow-hidden", contentClassName)}>
          {pages.map((item) => {
            const active = selected === item.key;
            const leaving = transition?.from === item.key;
            const animClass =
              active && transition
                ? `page-shell-enter-${transition.dir}`
                : leaving
                  ? `page-shell-exit-${transition.dir}`
                  : undefined;
            return (
              <div
                key={item.key}
                className={cn(
                  "absolute inset-0",
                  !active && !leaving && "hidden",
                  animClass,
                )}
              >
                {/* 每个子页独立滚动；只有声明了 scrollShadow 的条目才加边缘阴影 */}
                {item.scrollShadow ? (
                  <ScrollShadow
                    className="h-full"
                    contentClassName={pageClassName}
                    start={item.scrollShadow === "both"}
                  >
                    {item.content}
                  </ScrollShadow>
                ) : (
                  <div
                    className={cn(
                      "scroll-area h-full w-full overflow-x-hidden overflow-y-auto",
                      pageClassName,
                    )}
                  >
                    {item.content}
                  </div>
                )}
              </div>
            );
          })}
        </main>
      </div>
    </PageShellContext.Provider>
  );
}
