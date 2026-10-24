import { useRef, useState, useEffect, useCallback } from "react";
import { useRouteStore, routes, allRoutes } from "@/stores/routeStore";
import { WindowControls } from "./WindowControls";

interface TitleBarProps {
  showMinimize?: boolean;
  showMaximize?: boolean;
  showClose?: boolean;
}

/** 胶囊指示条拖出两端时的最大橡皮筋位移（px）；越拉阻力越大，最多到这里 */
const RUBBER_BAND_LIMIT = 75;

/**
 * 橡皮筋映射：在 [min, max] 内线性跟随，越界后位移按 1/(1+x) 衰减，
 * 无限拖动也只会无限逼近 limit，不会真的拉走。
 */
function rubberBand(value: number, min: number, max: number, limit: number): number {
  if (value < min) {
    const overshoot = min - value;
    return min - limit * (1 - 1 / (overshoot / limit + 1));
  }
  if (value > max) {
    const overshoot = value - max;
    return max + limit * (1 - 1 / (overshoot / limit + 1));
  }
  return value;
}

export function TitleBar({
  showMinimize = true,
  showMaximize = true,
  showClose = true,
}: TitleBarProps) {
  const current = useRouteStore((s) => s.current);
  const navigate = useRouteStore((s) => s.navigate);
  const titleBarMode = useRouteStore((s) => s.titleBarMode);
  const goBack = useRouteStore((s) => s.goBack);

  const isSub = titleBarMode === "sub";
  const isDefault = titleBarMode === "default";
  const isOobe = titleBarMode === "oobe";
  const isBlocked = titleBarMode === "blocked";

  const currentRoute = allRoutes.find((r) => r.key === current);
  // blocked（设备异常页）不提供返回入口：该状态不允许离开
  const showBack = !isBlocked && (isSub || (isOobe && currentRoute?.backable));

  const currentIdx = routes.findIndex((r) => r.key === current);

  const navRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  const isDragging = useRef(false);
  const hasDragged = useRef(false);
  const dragStartX = useRef(0);
  const dragStartLeft = useRef(0);
  const dragWidth = useRef(0);

  const updateIndicator = useCallback((idx: number) => {
    const btn = btnRefs.current[idx];
    const nav = navRef.current;
    if (!btn || !nav) return;
    const navRect = nav.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    setIndicator({
      left: btnRect.left - navRect.left,
      width: btnRect.width,
    });
  }, []);

  useEffect(() => {
    if (!isDefault) return;
    // 拖拽过程中位置完全由 pointermove（含橡皮筋）接管；
    // 否则跨过条目时 currentIdx 变化会把指示条瞬移回按钮，破坏拖拽手感
    if (isDragging.current) return;
    requestAnimationFrame(() => updateIndicator(currentIdx));
  }, [currentIdx, updateIndicator, isDefault]);

  useEffect(() => {
    if (!isDefault) return;
    const onResize = () => updateIndicator(currentIdx);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [currentIdx, updateIndicator, isDefault]);

  useEffect(() => {
    if (!isDefault) return;

    const onMove = (e: PointerEvent) => {
      if (!isDragging.current) return;
      const dx = e.clientX - dragStartX.current;
      if (Math.abs(dx) > 3) hasDragged.current = true;
      if (!hasDragged.current) return;

      const nav = navRef.current;
      if (!nav) return;
      const navRect = nav.getBoundingClientRect();
      // 右边界取最后一个条目的左边缘：不能用 scrollWidth —— 指示条自身的 translate
      // 会撑大 nav 的可滚动区域，正是它让右侧能“无限拉”、左侧却被 0 卡死。
      const lastBtn = btnRefs.current[routes.length - 1];
      const maxLeft = Math.max(
        0,
        lastBtn ? lastBtn.getBoundingClientRect().left - navRect.left : nav.clientWidth - dragWidth.current,
      );
      const rawLeft = dragStartLeft.current + dx;
      // 两端对称的橡皮筋：越界后阻力递增，最多超出 RUBBER_BAND_LIMIT，松手回弹
      const draggedLeft = rubberBand(rawLeft, 0, maxLeft, RUBBER_BAND_LIMIT);

      setIndicator((prev) => ({ ...prev, left: draggedLeft }));

      // 吸附/导航判断仍按真实区间内位置算，越界时固定落到首/尾条目
      const navLeft = Math.max(0, Math.min(maxLeft, draggedLeft));
      let nearestIdx = 0;
      let minDist = Infinity;
      btnRefs.current.forEach((btn, i) => {
        if (!btn) return;
        const rect = btn.getBoundingClientRect();
        const btnCenter = rect.left - navRect.left + rect.width / 2;
        const dist = Math.abs(navLeft + dragWidth.current / 2 - btnCenter);
        if (dist < minDist) { minDist = dist; nearestIdx = i; }
      });

      const latest = useRouteStore.getState().current;
      if (routes[nearestIdx] && routes[nearestIdx].key !== latest) {
        navigate(routes[nearestIdx].key);
      }
    };

    const onUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      const idx = routes.findIndex((r) => r.key === useRouteStore.getState().current);
      // 松手回弹：把越界位移弹回当前条目的真实位置（CSS transform 过渡是 spring）
      updateIndicator(idx < 0 ? 0 : idx);
    };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    };
  }, [navigate, updateIndicator, isDefault]);

  const handleNavPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      const nav = navRef.current;
      if (!nav) return;
      const btn = btnRefs.current[currentIdx];
      if (!btn) return;
      const navRect = nav.getBoundingClientRect();
      const btnRect = btn.getBoundingClientRect();

      isDragging.current = true;
      hasDragged.current = false;
      dragStartX.current = e.clientX;
      dragStartLeft.current = btnRect.left - navRect.left;
      dragWidth.current = btnRect.width;
    },
    [currentIdx],
  );

  const handleBtnClick = useCallback(
    (key: string) => {
      if (hasDragged.current) {
        hasDragged.current = false;
        return;
      }
      navigate(key as any);
    },
    [navigate],
  );

  return (
    <div
      className="titlebar fixed top-0 left-0 right-0 h-[40px] flex items-center z-[100] pointer-events-auto"
      style={{
        WebkitAppRegion: "drag",
        background: "var(--titlebar-bg)",
        backdropFilter: "blur(3px)",
        WebkitBackdropFilter: "blur(3px)",
        borderBottom: "1px solid var(--titlebar-border)",
        userSelect: "none",
      }}
    >
      {/* 左侧区域：品牌文字 */}
      <div className="flex items-center pl-3 shrink-0 relative z-10" style={{ WebkitAppRegion: "no-drag" }}>
        {/* 返回按钮 */}
        <div
          className="overflow-hidden transition-[width,opacity,margin] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
          style={{
            WebkitAppRegion: "no-drag",
            width: showBack ? 68 : 0,
            opacity: showBack ? 1 : 0,
            marginRight: showBack ? 8 : 0,
          }}
        >
          <button
            onClick={goBack}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors hover:bg-black/5 dark:hover:bg-white/10 text-foreground/60 hover:text-foreground whitespace-nowrap"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 3L5 8L10 13" />
            </svg>
            <span className="text-[13px] font-medium">返回</span>
          </button>
        </div>

        <span
          className="text-sm font-semibold tracking-wide text-foreground/80 transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] whitespace-nowrap"
        >
          Koring Launcher
        </span>
      </div>

      {/* 中间区域：胶囊菜单 */}
      <div
        className="absolute left-1/2 -translate-x-1/2 flex justify-center transition-opacity duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
        style={{
          opacity: isDefault ? 1 : 0,
          pointerEvents: isDefault ? "auto" : "none",
        }}
      >
        {isDefault && (
          <div
            ref={navRef}
            className="relative flex items-center"
            onPointerDown={handleNavPointerDown}
            style={{ touchAction: "none", WebkitAppRegion: "no-drag" }}
          >
            <div
              className="absolute left-0 h-[28px] rounded-full"
              style={{
                transform: `translateX(${indicator.left}px)`,
                width: indicator.width,
                background: "var(--indicator-bg)",
                boxShadow: "var(--indicator-shadow)",
                transition: isDragging.current
                  ? "none"
                  : "transform 300ms var(--ease-spring), width 300ms var(--ease-spring)",
              }}
            />

            {routes.map((r, i) => {
              const active = current === r.key;
              return (
                <button
                  key={r.key}
                  ref={(el) => { btnRefs.current[i] = el; }}
                  onClick={() => handleBtnClick(r.key)}
                  className={[
                    "relative z-10 px-4 py-[5px] text-[13px] font-medium rounded-full transition-[color,transform] duration-200 cursor-default active:scale-95",
                    active
                      ? "text-foreground"
                      : "text-foreground/40 hover:text-foreground/60",
                  ].join(" ")}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 右侧：窗口控制 */}
      <div className="flex items-center shrink-0 justify-end ml-auto relative z-10" style={{ WebkitAppRegion: "no-drag" }}>
        <WindowControls
          showMinimize={showMinimize}
          showMaximize={showMaximize}
          showClose={showClose}
          isSub={isSub}
          isOobe={isOobe}
          isBlocked={isBlocked}
        />
      </div>
    </div>
  );
}
