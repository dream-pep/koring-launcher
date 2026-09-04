import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { useBackgroundStore } from "@/stores/backgroundStore";
import { useThemeStore } from "@/stores/themeStore";
import { useRouteStore } from "@/stores/routeStore";
import { useDevStore } from "@/stores/devStore";
import { DEFAULT_BG } from "@/lib/mode";
import { resourceRegistry } from "@/resources/registry";
import { estimateDataUrlBytes } from "@/resources/image";

/** 可直接用于 CSS 的源（默认图/相对 URL/http(s)/file:/data:） */
const isCssSource = (v: string) => /^(data:|https?:|file:|\/|\.\/|\.\.\/)/i.test(v);

export function BackgroundLayer() {
  const { type, image, blur, opacity } = useBackgroundStore();
  const parallax = useThemeStore((s) => s.parallax);
  const route = useRouteStore((s) => s.current);
  const forceDisableContentBlur = useDevStore((s) => s.forceDisableContentBlur);
  const showContentBlur = route !== "home";

  // bgImage：最终可显示的资源引用（CSS url 或 koring-res:// URL 或颜色）。
  // 配置里若存的是本地文件路径（自定义壁纸），先置空等待主进程解析成 koring-res:// 引用，
  // 避免把文件路径直接当 CSS url 使用 / 闪默认图。
  const [bgImage, setBgImage] = useState<string | null>(() => {
    if (type === "color" || !image) return image ?? null;
    return isCssSource(image) ? image : null;
  });
  /** 解析后的文件字节（供资源注册表统计） */
  const [bgBytes, setBgBytes] = useState(0);

  const bgRef = useRef<HTMLDivElement>(null);

  // 解析背景源：默认图/颜色/data: 等直接用；
  // 本地文件路径 → 主进程校验后返回 koring-res:// 协议引用（流式，无 base64 副本）。
  // 代次守卫：防止慢的旧解析结果覆盖用户最新选择（行为不变，仅修竞态）。
  useEffect(() => {
    let cancelled = false;
    if (type === "color" || !image) {
      setBgImage(image ?? null);
      setBgBytes(0);
      return () => {
        cancelled = true;
      };
    }
    if (image === DEFAULT_BG || isCssSource(image)) {
      setBgImage(image);
      setBgBytes(0);
      return () => {
        cancelled = true;
      };
    }
    window.electronAPI?.resolveBackgroundResource?.(image).then((res) => {
      if (cancelled || !res) return;
      if (res.url) {
        setBgImage(res.url);
        setBgBytes(res.bytes || 0);
      } else {
        // 文件不可用/越权：回退默认背景（文件已失效，回退优于显示破损背景）
        setBgImage(DEFAULT_BG);
        setBgBytes(0);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [image, type]);

  // 当前生效的背景登记进资源注册表（估算字节、单持有者语义）：
  // 背景切换时旧条目被释放丢弃，大 dataURL/引用不再被缓存层额外持有。
  const trackedKey = useMemo(() => {
    if (!bgImage) return null;
    if (bgImage.startsWith("data:")) {
      // 只取前缀 + 长度作为 key，避免把整段 dataURL 重复存进 Map key
      return `background:current:${bgImage.length}:${bgImage.slice(0, 96)}`;
    }
    if (bgImage.startsWith("koring-res:")) {
      return `background:current:${bgImage}`;
    }
    return null;
  }, [bgImage]);

  useEffect(() => {
    if (!trackedKey) return;
    let cancelled = false;
    const isFileRef = bgImage?.startsWith("koring-res:");
    const bytes = isFileRef ? bgBytes : estimateDataUrlBytes(bgImage);
    resourceRegistry
      .acquire<string>(trackedKey, "background", {
        bytes,
        cache: false,
        load: async () => bgImage ?? "",
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
  }, [trackedKey, bgImage, bgBytes]);

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
    if (!parallax) {
      if (bgRef.current) bgRef.current.style.transform = "";
      return;
    }
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [parallax, handleMouseMove]);

  // 自定义壁纸在解析完成前不显示（等待 koring-res 引用），避免闪默认图
  const bgUrl = bgImage || DEFAULT_BG;
  const contentBlur = showContentBlur && !forceDisableContentBlur;

  const getBackgroundStyle = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: "fixed",
      inset: parallax ? -20 : 0,
      zIndex: 0,
      pointerEvents: "none",
      opacity,
      transition: "filter 0.4s cubic-bezier(0.4, 0, 0.2, 1), transform 0.1s ease-out",
    };

    const filters: string[] = [];
    if (blur > 0) filters.push(`blur(${blur}px)`);
    if (contentBlur) filters.push("blur(24px) saturate(120%)");
    if (filters.length) base.filter = filters.join(" ");

    if (type === "color") {
      return {
        ...base,
        backgroundColor: bgUrl,
      };
    }

    const style: React.CSSProperties = { ...base };
    if (bgImage) {
      style.backgroundImage = `url(${bgUrl})`;
      style.backgroundSize = "cover";
      style.backgroundPosition = "center";
    }
    return style;
  };

  return (
    <>
      <div ref={bgRef} style={getBackgroundStyle()} />
      <div
        className="content-blur-overlay"
        style={{ opacity: contentBlur ? 1 : 0 }}
      />
      <div className="dark:block hidden fixed inset-0 z-0 pointer-events-none bg-black/35" />
    </>
  );
}
