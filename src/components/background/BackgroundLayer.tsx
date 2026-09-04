import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { useBackgroundStore } from "@/stores/backgroundStore";
import { useThemeStore } from "@/stores/themeStore";
import { useRouteStore } from "@/stores/routeStore";
import { useDevStore } from "@/stores/devStore";
import { DEFAULT_BG } from "@/lib/mode";
import { resourceRegistry } from "@/resources/registry";
import { estimateDataUrlBytes } from "@/resources/image";

export function BackgroundLayer() {
  const { type, image, blur, opacity } = useBackgroundStore();
  const parallax = useThemeStore((s) => s.parallax);
  const route = useRouteStore((s) => s.current);
  const forceDisableContentBlur = useDevStore((s) => s.forceDisableContentBlur);
  const showContentBlur = route !== "home";
  const [bgImage, setBgImage] = useState(image);

  const bgRef = useRef<HTMLDivElement>(null);

  // 解析最终背景源：内置 URL / 颜色直接用；自定义路径经主进程取优化 dataURL。
  // 增加代次守卫：防止慢的旧 IPC 结果覆盖用户最新选择（行为不变，仅修竞态）。
  useEffect(() => {
    let cancelled = false;
    if (image && image !== DEFAULT_BG && !image.startsWith("data:")) {
      (window as any).electronAPI?.getBackgroundDataUrl?.().then((dataUrl: string | null) => {
        if (!cancelled && dataUrl) setBgImage(dataUrl);
      });
    } else {
      setBgImage(image);
    }
    return () => {
      cancelled = true;
    };
  }, [image]);

  // 当前生效的背景登记进资源注册表（估算字节、单持有者语义）：
  // 背景切换时旧条目被释放丢弃，大 dataURL 字符串不再被缓存层额外持有。
  const trackedKey = useMemo(() => {
    if (!bgImage || !bgImage.startsWith("data:")) return null;
    // 只取前缀 + 长度作为 key，避免把整段数 MB 的 dataURL 重复存进 Map key
    return `background:current:${bgImage.length}:${bgImage.slice(0, 96)}`;
  }, [bgImage]);

  useEffect(() => {
    if (!trackedKey) return;
    let cancelled = false;
    resourceRegistry
      .acquire<string>(trackedKey, "background", {
        bytes: estimateDataUrlBytes(bgImage),
        cache: false,
        load: async () => bgImage,
      })
      .then(() => {
        if (!cancelled) {
          resourceRegistry.setBytes(trackedKey, estimateDataUrlBytes(bgImage));
        }
      });
    return () => {
      cancelled = true;
      resourceRegistry.release(trackedKey);
    };
  }, [trackedKey, bgImage]);

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

    return {
      ...base,
      backgroundImage: `url(${bgUrl})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    };
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
