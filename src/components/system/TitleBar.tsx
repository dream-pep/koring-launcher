import { useCallback, useEffect, useRef, useState } from "react";
import { GlassContent, GlassScene, GlassSurface } from "@glass-sdk/liquid-glass";
import { useRouteStore, routes, allRoutes } from "@/stores/routeStore";
import { useIsDark } from "@/hooks/useIsDark";
import { Badge } from "@/components/ui/badge";
import { WindowControls } from "./WindowControls";

interface TitleBarProps {
  showMinimize?: boolean;
  showMaximize?: boolean;
  showClose?: boolean;
}

/** 胶囊指示条拖出两端时的最大橡皮筋位移（px）；到顶后不再继续移动 */
const RUBBER_BAND_LIMIT = 75;
/** 越界拖拽达到这个原始距离后，就拉满橡皮筋（约 220px），之后完全不再移动 */
const RUBBER_BAND_PULL = 220;

/**
 * 橡皮筋映射：在 [min, max] 内线性跟随；越界后先快后慢（三次缓出），
 * 越界拖动达到 RUBBER_BAND_PULL 时正好拉满 limit，再往后硬性停住。
 */
function rubberBand(value: number, min: number, max: number, limit: number): number {
  if (value < min) {
    const t = Math.min(1, (min - value) / RUBBER_BAND_PULL);
    return min - limit * (1 - Math.pow(1 - t, 3));
  }
  if (value > max) {
    const t = Math.min(1, (value - max) / RUBBER_BAND_PULL);
    return max + limit * (1 - Math.pow(1 - t, 3));
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

  // 跟随应用主题，让顶部选择器的玻璃 appearance 与背景一致
  const isDark = useIsDark();

  // 网络在线状态：监听浏览器 online / offline 事件
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);
  // 按压/拖拽时的液态形变（按钮盖在玻璃上，SDK 的 interactive 收不到指针，这里自己驱动）
  const [dragging, setDragging] = useState(false);

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
      setDragging(false);
      const idx = routes.findIndex((r) => r.key === useRouteStore.getState().current);
      // 松手回弹：把越界位移弹回当前条目的真实位置（CSS transform 过渡是 spring）
      updateIndicator(idx < 0 ? 0 : idx);
    };

    // 失焦/切窗口时也结束按住态，避免玻璃高光卡在开启状态
    const onBlur = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      hasDragged.current = false;
      setDragging(false);
    };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
      window.removeEventListener("blur", onBlur);
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
      // 按住就是液态玻璃，松开恢复平面（不等到开始移动）
      setDragging(true);
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

        {/* 网络状态徽章：仅断网时显示红色 Offline，在线时不显示 */}
        {!online && (
          <Badge variant="destructive" className="ml-2 font-semibold">
            Offline
          </Badge>
        )}
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
            {/* 液态玻璃选择器：SVG 位移折射 + 环形高光 + 镜面漂移（见 index.css .liquid-pill） */}
            <div
              className="absolute left-0 h-[28px]"
              style={{
                transform: `translateX(${indicator.left}px)`,
                width: indicator.width,
                transition: isDragging.current
                  ? "none"
                  : "transform 300ms var(--ease-spring), width 300ms var(--ease-spring)",
              }}
            >
              {/* 液态玻璃选择器：GlassScene/GlassSurface 负责折射与边缘光学；
                  GlassContent 不再铺任何底色（透出标题栏/壁纸），
                  按压/拖拽的形变由 .liquid-pill.is-dragging 的 spring 负责 */}
              <div
                className={`liquid-pill relative h-full w-full overflow-hidden${
                  dragging ? " is-dragging" : ""
                }`}
              >
                <div className="liquid-pill__glass" aria-hidden>
                  <GlassScene
                    material="clear"
                    appearance={isDark ? "dark" : "light"}
                    style={{ position: "absolute", inset: 0 }}
                  >
                    <GlassContent />
                    <GlassSurface
                      material="clear"
                      appearance={isDark ? "dark" : "light"}
                      radius="capsule"
                      interactive={false}
                      refraction={12}
                      style={{ position: "absolute", inset: 0 }}
                    />
                  </GlassScene>
                </div>
              </div>
            </div>

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
