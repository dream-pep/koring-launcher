import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { useBackgroundStore } from "@/stores/backgroundStore";
import { useThemeStore } from "@/stores/themeStore";
import { useRouteStore } from "@/stores/routeStore";
import { useDevStore } from "@/stores/devStore";
import { DEFAULT_BG } from "@/lib/mode";
import { resourceRegistry } from "@/resources/registry";
import { estimateDataUrlBytes } from "@/resources/image";
import { createRendererLogger } from "@/lib/logger";

const log = createRendererLogger("BackgroundLayer");

/** 可直接用于 CSS/img/video 的源（默认图/相对 URL/http(s)/file:/data:） */
function isCssSource(v: string): boolean {
  return /^(data:|https?:|file:|\/|\.\/|\.\.\/)/i.test(v);
}

/** 壁纸切换渐入时长（ms）；与 .bg-fade-in 动画时长保持一致 */
const FADE_MS = 600;

/** 把 Store 里的值（默认图 / 相对 URL / 本地文件路径）解析成可显示的资源引用 */
function useResolvedUrl(value: string | null): { url: string | null; bytes: number } {
  const [state, setState] = useState<{ url: string | null; bytes: number }>(() => ({
    url: value && (value === DEFAULT_BG || isCssSource(value)) ? value : null,
    bytes: 0,
  }));

  useEffect(() => {
    let cancelled = false;
    if (!value) {
      setState({ url: null, bytes: 0 });
      return;
    }
    if (value === DEFAULT_BG || isCssSource(value)) {
      setState({ url: value, bytes: 0 });
      return;
    }
    // 本地文件路径 → 主进程校验后返回 koring-res:// 协议引用
    window.electronAPI?.resolveBackgroundResource?.(value).then((res) => {
      if (cancelled) return;
      if (res?.url) {
        setState({ url: res.url, bytes: res.bytes || 0 });
      } else {
        log.warn(`背景资源解析失败/越权，回退默认背景：${value}`);
        setState({ url: DEFAULT_BG, bytes: 0 });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [value]);

  return state;
}

/**
 * 背景层：按「背景模式」渲染 Mica（透出系统材质）/ 纯色 / 图片（多图轮换）/ 视频 / GIF。
 * 视频始终静音（muted + volume=0），不会发出任何声音。
 */
export function BackgroundLayer() {
  const mode = useBackgroundStore((s) => s.mode);
  const images = useBackgroundStore((s) => s.images);
  const rotateSeconds = useBackgroundStore((s) => s.imageRotateSeconds);
  const video = useBackgroundStore((s) => s.video);
  const gif = useBackgroundStore((s) => s.gif);
  const color = useBackgroundStore((s) => s.color);
  const blur = useBackgroundStore((s) => s.blur);
  const opacity = useBackgroundStore((s) => s.opacity);
  const parallax = useThemeStore((s) => s.parallax);
  const route = useRouteStore((s) => s.current);
  const forceDisableContentBlur = useDevStore((s) => s.forceDisableContentBlur);
  const showContentBlur = route !== "home";

  const bgRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // ── 图片模式：轮换下标 ──────────────────────────────────
  const [slide, setSlide] = useState(0);
  const imageCount = images.length;
  useEffect(() => {
    if (imageCount === 0) return;
    setSlide((i) => i % imageCount);
  }, [imageCount]);

  useEffect(() => {
    if (mode !== "image" || imageCount < 2 || rotateSeconds <= 0) return;
    const timer = window.setInterval(() => {
      // 窗口不可见时暂停轮换，避免后台空转
      if (document.hidden) return;
      setSlide((i) => (i + 1) % imageCount);
    }, rotateSeconds * 1000);
    return () => window.clearInterval(timer);
  }, [mode, imageCount, rotateSeconds]);

  const currentImage = mode === "image" ? images[slide] ?? images[0] ?? DEFAULT_BG : null;
  const gifSource = mode === "gif" ? gif || DEFAULT_BG : null;
  const videoSource = mode === "video" ? video || null : null;

  const resolvedImage = useResolvedUrl(currentImage);
  const resolvedGif = useResolvedUrl(gifSource);
  const resolvedVideo = useResolvedUrl(videoSource);

  // ── Mica：窗口透明，透出系统材质（html[data-bg-mode="mica"] 让 body 透明）──
  useEffect(() => {
    const root = document.documentElement;
    if (mode === "mica") {
      root.dataset.bgMode = "mica";
    } else {
      delete root.dataset.bgMode;
    }
    return () => {
      delete root.dataset.bgMode;
    };
  }, [mode]);

  // ── 视频：强制静音（任何情况下都不出声）──
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = true;
    el.volume = 0;
    el.defaultMuted = true;
    // 部分内核在 autoplay 被拦截时静音仍可播放；失败只记录，不回退
    const play = () => {
      el.volume = 0;
      void el.play().catch((e) => log.warn(`视频背景自动播放失败: ${String(e)}`));
    };
    play();
  }, [resolvedVideo.url]);

  // ── 双层交叉淡化（图片 / GIF）──
  const fadeSource = mode === "image" ? resolvedImage.url : mode === "gif" ? resolvedGif.url : null;
  const fadeBytes = mode === "image" ? resolvedImage.bytes : resolvedGif.bytes;
  const [active, setActive] = useState<string | null>(null);
  const [previous, setPrevious] = useState<string | null>(null);
  const [fading, setFading] = useState(false);
  const committedRef = useRef<string | null>(null);
  const activeRef = useRef<string | null>(null);

  useEffect(() => {
    if (fadeSource === committedRef.current) return;
    committedRef.current = fadeSource;
    const oldActive = activeRef.current;
    setPrevious(oldActive);
    setActive(fadeSource);
    activeRef.current = fadeSource;
    if (oldActive != null && fadeSource != null && oldActive !== fadeSource) {
      setFading(true);
    }
  }, [fadeSource]);

  useEffect(() => {
    if (!fading) return;
    const timer = setTimeout(() => setFading(false), FADE_MS + 120);
    return () => clearTimeout(timer);
  }, [fading]);

  // ── 当前生效的背景登记进资源注册表（大图不常驻缓存）──
  const trackedUrl = fadeSource ?? resolvedVideo.url;
  const trackedBytes = fadeSource ? fadeBytes : resolvedVideo.bytes;
  const trackedKey = useMemo(() => {
    if (!trackedUrl) return null;
    if (trackedUrl.startsWith("koring-res:")) return `background:current:${trackedUrl}`;
    if (trackedUrl.startsWith("data:")) {
      return `background:current:${trackedUrl.length}:${trackedUrl.slice(0, 96)}`;
    }
    return null;
  }, [trackedUrl]);

  useEffect(() => {
    if (!trackedKey || !trackedUrl) return;
    let cancelled = false;
    const isFileRef = trackedUrl.startsWith("koring-res:");
    const bytes = isFileRef ? trackedBytes : estimateDataUrlBytes(trackedUrl);
    resourceRegistry
      .acquire<string>(trackedKey, "background", {
        bytes,
        cache: false,
        load: async () => trackedUrl,
      })
      .then(() => {
        if (!cancelled) resourceRegistry.setBytes(trackedKey, bytes);
      });
    return () => {
      cancelled = true;
      resourceRegistry.release(trackedKey);
    };
  }, [trackedKey, trackedUrl, trackedBytes]);

  // ── 视差 ──────────────────────────────────────────────
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!parallax || !bgRef.current) return;
      const x = (e.clientX / window.innerWidth - 0.5) * 20;
      const y = (e.clientY / window.innerHeight - 0.5) * 20;
      bgRef.current.style.transform = `translate(${x}px, ${y}px) scale(1.05)`;
    },
    [parallax],
  );

  useEffect(() => {
    const bg = bgRef.current;
    if (!parallax) {
      if (bg) {
        bg.style.transform = "";
        bg.style.willChange = "";
      }
      return;
    }
    if (bg) bg.style.willChange = "transform";
    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (bg) bg.style.willChange = "";
    };
  }, [parallax, handleMouseMove]);

  const contentBlur = showContentBlur && !forceDisableContentBlur;
  const isImageLike = mode === "image" || mode === "gif";

  const containerStyle = (): React.CSSProperties => {
    const style: React.CSSProperties = {
      position: "fixed",
      inset: parallax ? -20 : 0,
      zIndex: 0,
      pointerEvents: "none",
      opacity: mode === "mica" ? 1 : opacity,
      transition: "filter 0.4s cubic-bezier(0.4, 0, 0.2, 1), transform 200ms ease-out",
    };
    const filters: string[] = [];
    // 首页保持壁纸原样：背景模糊只作用于内容页
    if (blur > 0 && showContentBlur) filters.push(`blur(${blur}px)`);
    if (contentBlur) filters.push("blur(24px) saturate(120%)");
    if (filters.length) style.filter = filters.join(" ");
    if (mode === "color") style.backgroundColor = color;
    return style;
  };

  const imageLayerStyle = (url: string): React.CSSProperties => ({
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    backgroundImage: `url(${url})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
  });

  const showPrevious = fading && previous != null && previous !== active;

  return (
    <>
      <div ref={bgRef} style={containerStyle()} data-bg-mode={mode}>
        {isImageLike && (
          <>
            {showPrevious && previous && <div style={imageLayerStyle(previous)} />}
            {active && (
              <div
                key={active}
                className={showPrevious ? "bg-fade-in" : undefined}
                style={imageLayerStyle(active)}
              />
            )}
          </>
        )}

        {/* 图片模式：多图轮换时的预加载，避免切换瞬间空白 */}
        {mode === "image" && imageCount > 1 && (
          <div aria-hidden className="hidden">
            {images.map((src) => (
              <span key={src} data-bg-preload={src} />
            ))}
          </div>
        )}

        {/* GIF：用 <img> 保留动画 */}
        {mode === "gif" && resolvedGif.url && (
          <img
            src={resolvedGif.url}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            style={{ pointerEvents: "none" }}
            draggable={false}
          />
        )}

        {/* 视频：自动播放 + 循环 + 内联 + 强制静音（不渲染控制条，不会有任何声音） */}
        {mode === "video" && resolvedVideo.url && (
          <video
            ref={videoRef}
            src={resolvedVideo.url}
            className="absolute inset-0 h-full w-full object-cover"
            style={{ pointerEvents: "none" }}
            autoPlay
            loop
            muted
            playsInline
            disablePictureInPicture
            controls={false}
            preload="auto"
            tabIndex={-1}
          />
        )}
      </div>
      <div className="content-blur-overlay" style={{ opacity: contentBlur ? 1 : 0 }} />
      {mode !== "mica" && (
        <div className="dark:block hidden fixed inset-0 z-0 pointer-events-none bg-black/35" />
      )}
    </>
  );
}
