import { useEffect, useState } from "react";
import { BUILD_MODE, LOGO_SVG } from "@/lib/mode";

export default function Splash() {
  const [phase, setPhase] = useState<"enter" | "visible">("enter");
  const [version, setVersion] = useState("");

  useEffect(() => {
    window.electronAPI?.invoke('system:info').then((result: any) => {
      setVersion(result?.data?.app_version || '');
    }).catch(() => {});
    const t = setTimeout(() => setPhase("visible"), 50);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className="w-full h-full flex flex-col overflow-hidden"
      style={{
        background: "var(--splash-bg)",
      }}
    >
      {/* Centered logo */}
      <div
        className="flex-1 flex items-center justify-center"
        style={{
          opacity: phase === "enter" ? 0 : 1,
          transform: phase === "enter" ? "translateY(10px)" : "translateY(0)",
          transition: "all 0.7s ease-out",
        }}
      >
        <img
          src={LOGO_SVG}
          alt="Koring Launcher"
          className="splash-logo"
          style={{ width: 260, height: "auto" }}
        />
      </div>

      {/* Bottom bar */}
      <div className="flex items-center justify-between px-6 pb-4 text-xs text-muted-foreground">
        <span>Provided by Lingke Koring Studio</span>
        <span className="flex items-center gap-1.5">
          {version && <span>v{version}</span>}
          {BUILD_MODE !== "run" && (
            <span
              className={[
                "text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none select-none",
                BUILD_MODE === "dev"
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  : "bg-amber-500/15 text-amber-600 dark:text-amber-400",
              ].join(" ")}
            >
              {BUILD_MODE === "dev" ? "DEV" : "BETA"}
            </span>
          )}
        </span>
      </div>

      <style>{`
        :root {
          --splash-bg: #ffffff;
        }
        .dark {
          --splash-bg: #1a1a2e;
        }
        .splash-logo {
          filter: none;
        }
        .dark .splash-logo {
          filter: invert(1);
        }
      `}</style>
    </div>
  );
}
