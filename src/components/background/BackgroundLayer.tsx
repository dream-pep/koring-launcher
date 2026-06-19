import { useEffect } from "react";
import { useBackgroundStore } from "@/stores/backgroundStore";

const DEFAULT_BG = "/background.png";

export function BackgroundLayer() {
  const { type, image, color, blur, opacity, animationSpeed, fetchConfig } = useBackgroundStore();

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const getBackgroundStyle = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: "fixed",
      inset: 0,
      zIndex: 0,
      pointerEvents: "none",
      opacity,
    };

    if (blur > 0) {
      base.filter = `blur(${blur}px)`;
    }

    switch (type) {
      case "image":
        return {
          ...base,
          backgroundImage: `url(${image || DEFAULT_BG})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        };
      case "color":
        return {
          ...base,
          backgroundColor: color || "#1a1a2e",
          backgroundImage: `url(${DEFAULT_BG})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        };
      case "gradient":
        return {
          ...base,
          background: `linear-gradient(135deg, ${color || "#1a1a2e"}, #16213e, #0f3460)`,
          animation: `gradient-shift ${10 / animationSpeed}s ease infinite`,
        };
      case "particles":
        return {
          ...base,
          background: `radial-gradient(circle at 20% 50%, rgba(${color || "26,26,46"}, 0.8) 0%, transparent 50%),
                       radial-gradient(circle at 80% 20%, rgba(22, 33, 62, 0.6) 0%, transparent 40%),
                       radial-gradient(circle at 50% 80%, rgba(15, 52, 96, 0.4) 0%, transparent 60%)`,
          animation: `particles-float ${20 / animationSpeed}s ease-in-out infinite`,
        };
      default:
        return {
          ...base,
          backgroundImage: `url(${DEFAULT_BG})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        };
    }
  };

  return (
    <>
      <style>{`
        @keyframes gradient-shift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes particles-float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          33% { transform: translateY(-10px) rotate(1deg); }
          66% { transform: translateY(10px) rotate(-1deg); }
        }
      `}</style>
      <div style={getBackgroundStyle()} />
    </>
  );
}
