import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { useBackgroundStore } from "@/stores/backgroundStore";
import { useThemeStore } from "@/stores/themeStore";
import { useRouteStore } from "@/stores/routeStore";
import { useDevStore } from "@/stores/devStore";
import { useA11yStore } from "@/stores/a11yStore";
import { DEFAULT_BG } from "@/lib/mode";
import { resourceRegistry } from "@/resources/registry";
import { estimateDataUrlBytes } from "@/resources/image";
import { createRendererLogger } from "@/lib/logger";

const log = createRendererLogger("BackgroundLayer");

/** 可直接用于 CSS 的源（默认图/相对 URL/http(s)/file:/data:） */
const isCssSource = (v: string) => /^(data:|https?:|file:|\/|\.\/|\.\.\/)/i.test(v);

/** 壁纸切换渐入时长（ms）；与 .bg-fade-in 动画时长保持一致 */
const FADE_MS = 600;

interface ResolvedResource {
  url: string;
  bytes: number;
}

/** 把配置里的背景值解析成可直接显示的资源引用（koring-res:// 协议 URL） */
async function resolveBackgroundValue(value: string): Promise<ResolvedResource | null> {
  if (!value) return null;
  if (value === DEFAULT_BG || isCssSource(value)) return { url: value, bytes: 0 };
  const res = await window.electronAPI?.resolveBackgroundResource?.(value);
  return res?.url ? { url: res.url, bytes: res.bytes || 0 } : null;
}

export function BackgroundLayer() {
  const { type, image, images, video, intervalSec, blur, opacity } = useBackgroundStore();
  const parallax = useThemeStore((s) => s.parallax);
  const reduceMotion = useA11yStore((s) => s.reduceMotion);
  const route = useRouteStore((s) => s.current);
  const forceDisableContentBlur = useDevStore((s) => s.forceDisableContentBlur);
  const showContentBlur = route !== "home";

  /** 单图 / 旧版纯色模式解析结果 */
  const [resolvedImage, setResolvedImage] = useState<string | null>(() => {
    if (type === "color" || !image) return image ?? null;
    return isCssSource(image) ? image : null;
  });
  /** 多图轮播解析结果（按配置顺序） */
  const [resolvedImages, setResolvedImages] = useState<string[]>([]);
  /** 视频模式解析结果 */
  const [resolvedVideo, setResolvedVideo] = useState<string | null>(null);
  /** URL → 文件字节（供资源注册表统计） */
  const bytesRef = useRef<Record<string, number>>({});

  // 双层背景做切换渐入：previous 为旧背景（保留至淡出结束），active 为新背景（带 fade-in）
  const [active, setActive] = useState<string | null>(null);
  const [previous, setPrevious] = useState<string | null>(null);
  const [fading, setFading] = useState(false);
  const committedRef = useRef<string | null>(null);
  const activeRef = useRef<string | null>(null);

  const bgRef = useRef<HTMLDivElement>(null);

  // ---- 单图解析：默认图/颜色/data: 等直接用；本地文件 → 主进程校验后返回协议引用 ----
  useEffect(() => {
    let cancelled = false;
    if (type === "color" || !image) {
      setResolvedImage(image ?? null);
      return () => {
        cancelled = true;
      };
    }
    if (image === DEFAULT_BG || isCssSource(image)) {
      setResolvedImage(image);
      return () => {
        cancelled = true;
      };
    }
    resolveBackgroundValue(image).then((res) => {
      if (cancelled) return;
      if (res?.url) {
        bytesRef.current[res.url] = res.bytes;
        log.info(`背景资源解析成功：${image} → ${res.url} (${res.bytes}B)`);
        setResolvedImage(res.url);
      } else {
        // 文件不可用/越权：回退默认背景（文件已失效，回退优于显示破损背景）
        log.warn(`背景资源解析失败/越权，回退默认背景：${image}`);
        setResolvedImage(DEFAULT_BG);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [image, type]);

  // ---- 多图轮播解析：并行解析全部图片，单个失败跳过 ----
  const imagesKey = images.join("\n");
  useEffect(() => {
    let cancelled = false;
    if (type !== "slideshow" || !imagesKey) {
      setResolvedImages([]);
      return () => {
        cancelled = true;
      };
    }
    Promise.all(images.map((value) => resolveBackgroundValue(value))).then((list) => {
      if (cancelled) return;
      const urls: string[] = [];
      for (const item of list) {
        if (!item?.url) continue;
        bytesRef.current[item.url] = item.bytes;
        urls.push(item.url);
      }
      if (urls.length !== images.length) {
        log.warn(`轮播图片部分不可用：${urls.length}/${images.length}`);
      }
      setResolvedImages(urls);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, imagesKey]);

  // ---- 视频解析 ----
  useEffect(() => {
    let cancelled = false;
    if (type !== "video" || !video) {
      setResolvedVideo(null);
      return () => {
        cancelled = true;
      };
    }
    resolveBackgroundValue(video).then((res) => {
      if (cancelled) return;
      if (res?.url) {
        bytesRef.current[res.url] = res.bytes;
        log.info(`视频背景解析成功：${video} → ${res.url} (${res.bytes}B)`);
        setResolvedVideo(res.url);
      } else {
        log.warn(`视频背景解析失败，回退默认背景：${video}`);
        setResolvedVideo(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [video, type]);

  // 当前可轮播的图片序列（轮播列表为空时回退默认背景，避免黑屏）
  const playlist = useMemo(() => {
    if (type === "slideshow") {
      return resolvedImages.length > 0 ? resolvedImages : [DEFAULT_BG];
    }
    if (type === "image") {
      return [resolvedImage ?? DEFAULT_BG];
    }
    return [];
  }, [type, resolvedImages, resolvedImage]);
  const playlistKey = playlist.join("|");

  const [index, setIndex] = useState(0);

  // 列表变化（增删图片/切换模式）后从第一张重新开始
  useEffect(() => {
    setIndex(0);
  }, [playlistKey]);

  // 多图自动轮播：默认 30 秒；开启「减少动画」时停在当前图，不自动切换
  useEffect(() => {
    if (type !== "slideshow" || reduceMotion || playlist.length < 2) return;
    const delay = Math.max(5, Math.round(intervalSec)) * 1000;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % playlist.length);
    }, delay);
    return () => window.clearInterval(timer);
  }, [type, reduceMotion, playlist.length, intervalSec]);

  const currentImage = playlist.length > 0 ? playlist[index % playlist.length] : null;
  const nextSrc = type === "video" ? resolvedVideo : currentImage;

  // 提交新背景到「双层交叉淡化」状态机（相同 URL 忽略；旧背景保留至淡出结束）
  useEffect(() => {
    if (nextSrc === committedRef.current) return;
    committedRef.current = nextSrc;
    const oldActive = activeRef.current;
    setPrevious(oldActive);
    setActive(nextSrc);
    activeRef.current = nextSrc;
    log.debug(`背景切换 ${oldActive ?? "(无)"} → ${nextSrc ?? "(无)"}`);
    if (oldActive != null && nextSrc != null && oldActive !== nextSrc) {
      setFading(true);
    }
  }, [nextSrc]);

  useEffect(() => {
    if (!fading) return;
    const timer = setTimeout(() => setFading(false), FADE_MS + 120);
    return () => clearTimeout(timer);
  }, [fading]);

  // 当前生效的背景登记进资源注册表（估算字节、单持有者语义）：
  // 背景切换时旧条目被释放丢弃，大 dataURL/引用不再被缓存层额外持有。
  const trackedKey = useMemo(() => {
    if (!active) return null;
    if (active.startsWith("data:")) {
      return `background:current:${active.length}:${active.slice(0, 96)}`;
    }
    if (active.startsWith("koring-res:")) {
      return `background:current:${active}`;
    }
    return null;
  }, [active]);

  useEffect(() => {
    if (!trackedKey || !active) return;
    let cancelled = false;
    const bytes = active.startsWith("koring-res:")
      ? bytesRef.current[active] ?? 0
      : estimateDataUrlBytes(active);
    resourceRegistry
      .acquire<string>(trackedKey, "background", {
        bytes,
        cache: false,
        load: async () => active,
      })
      .then(() => {
        if (!cancelled) {
          resourceRegistry.setBytes(trackedKey, bytes);
        }
      });
    return () => {
      cancelled = true;
      resourceRegistry.release(trackedKey);
    };
  }, [trackedKey, active]);

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
      // 视差关闭：清掉 transform 与 will-change，避免常驻合成层
      if (bg) {
        bg.style.transform = "";
        bg.style.willChange = "";
      }
      return;
    }
    // 视差开启：提前提升为合成层，translate 走 GPU 不触发重绘
    if (bg) bg.style.willChange = "transform";
    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (bg) bg.style.willChange = "";
    };
  }, [parallax, handleMouseMove]);

  const contentBlur = showContentBlur && !forceDisableContentBlur;

  // 外层容器：定位/不透明度/模糊滤镜/视差变换；图片内容由内部双层承载
  const containerStyle = (): React.CSSProperties => {
    const style: React.CSSProperties = {
      position: "fixed",
      inset: parallax ? -20 : 0,
      zIndex: 0,
      pointerEvents: "none",
      opacity,
      transition: "filter 0.4s cubic-bezier(0.4, 0, 0.2, 1), transform 200ms ease-out",
    };
    const filters: string[] = [];
    // 首页保持壁纸原样：背景模糊（主题与背景里的设置）只作用于内容页，
    // 与内容模糊层同条件，避免首页壁纸被模糊。
    if (blur > 0 && showContentBlur) filters.push(`blur(${blur}px)`);
    if (contentBlur) filters.push("blur(24px) saturate(120%)");
    if (filters.length) style.filter = filters.join(" ");
    if (type === "color") {
      style.backgroundColor = active ?? image ?? DEFAULT_BG;
    }
    return style;
  };

  const imageLayerStyle = (url: string): React.CSSProperties => ({
    position: "absolute",
    inset: 0,
    pointerEvents: "none", // 背景层永不接收任何指针事件
    backgroundImage: `url(${url})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
  });

  const showPrevious = fading && previous != null && previous !== active;
  const isImageMode = type === "image" || type === "slideshow";

  return (
    <>
      <div ref={bgRef} style={containerStyle()}>
        {type === "video" ? (
          resolvedVideo ? (
            <video
              key={resolvedVideo}
              className="bg-fade-in absolute inset-0 h-full w-full object-cover"
              src={resolvedVideo}
              muted
              autoPlay={!reduceMotion}
              loop
              playsInline
              preload="auto"
              disablePictureInPicture
              aria-hidden
            />
          ) : null
        ) : isImageMode ? (
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
        ) : null}
      </div>
      <div
        className="content-blur-overlay"
        style={{ opacity: contentBlur ? 1 : 0 }}
      />
      <div className="dark:block hidden fixed inset-0 z-0 pointer-events-none bg-black/35" />
    </>
  );
}
