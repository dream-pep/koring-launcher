import { useEffect, useRef, useCallback } from "react";
import { useBackgroundStore } from "@/stores/backgroundStore";
import { useThemeStore } from "@/stores/themeStore";
import { useRouteStore } from "@/stores/routeStore";
import { useDevStore } from "@/stores/devStore";
import { DEFAULT_BG } from "@/lib/mode";

export function BackgroundLayer() {
  const { type, image, blur, opacity } = useBackgroundStore();
  const parallax = useThemeStore((s) => s.parallax);
  const route = useRouteStore((s) => s.current);
  const forceDisableContentBlur = useDevStore((s) => s.forceDisableContentBlur);
  const showContentBlur = route !== "home";

  const bgRef = useRef<HTMLDivElement>(null);

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

  const bgUrl = image || DEFAULT_BG;
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
