import { useEffect, useRef, useCallback } from "react";
import { useBackgroundStore } from "@/stores/backgroundStore";
import { useThemeStore } from "@/stores/themeStore";
import { useRouteStore } from "@/stores/routeStore";
import { useDevStore } from "@/stores/devStore";

const DEFAULT_BG = "/background.png";

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

  const getBackgroundStyle = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: "fixed",
      inset: parallax ? -20 : 0,
      zIndex: 0,
      pointerEvents: "none",
      opacity,
      transition: parallax ? "transform 0.1s ease-out" : undefined,
    };

    if (blur > 0) {
      base.filter = `blur(${blur}px)`;
    }

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
        style={{ opacity: showContentBlur && !forceDisableContentBlur ? 1 : 0 }}
      />
      <div className="dark:block hidden fixed inset-0 z-0 pointer-events-none bg-black/35" />
    </>
  );
}
