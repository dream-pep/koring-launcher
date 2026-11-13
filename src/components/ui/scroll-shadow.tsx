/**
 * ScrollShadow — 带滚动阴影的滚动容器
 *
 * 在滚动区域的上/下（或左/右）边缘叠一层极淡的渐变阴影，提示「这边还有被遮挡的内容」，
 * 并随滚动位置自动显隐：滚到顶部 → 顶部阴影淡出；滚到底部 → 底部阴影淡出；
 * 内容不足一屏 → 两侧都不显示。
 *
 * 为什么不用 mask-image 或主题色渐变：
 * 1) 启动器页面本身是透明的（背景是壁纸 / 主题背景），用 `from-background` 这类主题色渐变
 *    会在壁纸上压出一条色带；这里用极淡的中性色（浅色偏暗、深色偏亮），任何背景上都读作阴影。
 * 2) mask-image 会在祖先上建立 backdrop root，导致子元素上的 backdrop-filter（毛玻璃卡片）
 *    失效，所以阴影改用叠层渐变实现。
 *
 * 用法：
 *   <ScrollShadow className="h-full" contentClassName="p-8">{content}</ScrollShadow>
 *   <ScrollShadow orientation="horizontal" size={20}>{content}</ScrollShadow>
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
  type RefObject,
} from "react";
import { cn } from "@/lib/utils";

/** 滚动位置：start = 已到起点（顶/左），end = 已到终点（底/右） */
export interface ScrollEdges {
  start: boolean;
  end: boolean;
}

const AT_BOTH_ENDS: ScrollEdges = { start: true, end: true };

/**
 * 内容溢出少于这个像素数时，视为「没有可滚动的内容」：
 * 布局抖动/亚像素取整常让内容比视口高 1~3px，这类溢出不该触发阴影，
 * 否则页面上会一直挂着两条淡淡的光带，看着很怪。
 */
const MIN_OVERFLOW = 4;

/** 监听滚动容器的端点状态（滚到顶/底、内容是否溢出），供滚动阴影等场景复用 */
export function useScrollEdges(
  scrollRef: RefObject<HTMLElement | null>,
  options: { orientation?: "vertical" | "horizontal"; offset?: number } = {},
): ScrollEdges {
  const { orientation = "vertical", offset = 2 } = options;
  const [edges, setEdges] = useState<ScrollEdges>(AT_BOTH_ENDS);

  const measure = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const vertical = orientation === "vertical";
    const pos = vertical ? el.scrollTop : el.scrollLeft;
    const viewport = vertical ? el.clientHeight : el.clientWidth;
    const total = vertical ? el.scrollHeight : el.scrollWidth;
    // 内容几乎不溢出 → 两头都按「已到端点」处理，两张阴影都隐藏
    if (total - viewport <= MIN_OVERFLOW) {
      setEdges((prev) => (prev.start && prev.end ? prev : AT_BOTH_ENDS));
      return;
    }
    const start = pos <= offset;
    const end = pos + viewport >= total - offset;
    setEdges((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
  }, [orientation, offset, scrollRef]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    measure();
    el.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);

    // 内容变化（异步加载、折叠展开、保活页重新显示）后重新测量：容器尺寸 + 每个子元素尺寸
    const resizeObserver = new ResizeObserver(() => measure());
    const observe = () => {
      resizeObserver.disconnect();
      resizeObserver.observe(el);
      for (const child of Array.from(el.children)) resizeObserver.observe(child);
    };
    observe();

    const mutationObserver = new MutationObserver(() => {
      observe();
      measure();
    });
    mutationObserver.observe(el, { childList: true, subtree: true });

    return () => {
      el.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [measure, scrollRef]);

  return edges;
}

export interface ScrollShadowProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "className" | "children" | "style"> {
  children?: ReactNode;
  /** 外层定位容器 class（滚动容器按 h-full/w-full 填满它） */
  className?: string;
  /** 滚动容器自身 class（padding、space-y 等放这里） */
  contentClassName?: string;
  /** 滚动容器的 id（有些页面需要拿它回顶/定位） */
  id?: string;
  /** 滚动容器自身 style */
  style?: CSSProperties;
  /** 滚动方向，默认纵向 */
  orientation?: "vertical" | "horizontal";
  /** 阴影高度（纵向）/ 宽度（横向），单位 px */
  size?: number;
  /** 端点判定容差，单位 px（避免亚像素误差导致阴影闪动） */
  offset?: number;
  /** 额外的边缘模糊（px，默认 0 = 只叠渐变阴影；开启后会同时做 mask 渐隐） */
  blur?: number;
  /** 外部需要拿到滚动容器的 ref（回顶、监听滚动、无限滚动等） */
  scrollRef?: RefObject<HTMLDivElement | null>;
  /** 是否显示起点侧（顶/左）阴影，默认 true */
  start?: boolean;
  /** 是否显示终点侧（底/右）阴影，默认 true */
  end?: boolean;
  /** 允许透传 data-* 属性（如 data-textless-keep） */
  [key: `data-${string}`]: string | undefined;
}

export function ScrollShadow({
  children,
  className,
  contentClassName,
  id,
  style,
  orientation = "vertical",
  size = 24,
  offset = 2,
  blur = 0,
  scrollRef: externalScrollRef,
  start = true,
  end = true,
  ...rest
}: ScrollShadowProps) {
  const vertical = orientation === "vertical";
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const edges = useScrollEdges(scrollRef, { orientation, offset });

  const setScrollNode = useCallback(
    (node: HTMLDivElement | null) => {
      scrollRef.current = node;
      if (externalScrollRef) {
        (externalScrollRef as { current: HTMLDivElement | null }).current = node;
      }
    },
    [externalScrollRef],
  );

  const fadeMask = vertical
    ? "linear-gradient(to bottom, #000, transparent)"
    : "linear-gradient(to right, #000, transparent)";
  const fadeMaskEnd = vertical
    ? "linear-gradient(to top, #000, transparent)"
    : "linear-gradient(to left, #000, transparent)";

  const edgeStyle = (atStart: boolean, mask: string): CSSProperties => ({
    ...(vertical ? { height: size } : { width: size }),
    opacity: atStart ? 0 : 1,
    ...(blur > 0
      ? {
          backdropFilter: `blur(${blur}px)`,
          WebkitBackdropFilter: `blur(${blur}px)`,
          maskImage: mask,
          WebkitMaskImage: mask,
        }
      : {}),
  });

  return (
    <div className={cn("relative", className)} {...rest}>
      <div
        ref={setScrollNode}
        id={id}
        style={style}
        className={cn(
          "scroll-area h-full w-full",
          vertical ? "overflow-x-hidden overflow-y-auto" : "overflow-y-hidden overflow-x-auto",
          contentClassName,
        )}
      >
        {children}
      </div>

      {/* 起点侧阴影（顶/左） */}
      {start && (
        <div
          aria-hidden
          className={cn(
            "scroll-shadow-start pointer-events-none absolute z-10 transition-opacity duration-200 ease-out",
            vertical ? "scroll-shadow-y inset-x-0 top-0" : "scroll-shadow-x inset-y-0 left-0",
          )}
          style={edgeStyle(edges.start, fadeMask)}
        />
      )}

      {/* 终点侧阴影（底/右） */}
      {end && (
        <div
          aria-hidden
          className={cn(
            "scroll-shadow-end pointer-events-none absolute z-10 transition-opacity duration-200 ease-out",
            vertical ? "scroll-shadow-y inset-x-0 bottom-0" : "scroll-shadow-x inset-y-0 right-0",
          )}
          style={edgeStyle(edges.end, fadeMaskEnd)}
        />
      )}
    </div>
  );
}
