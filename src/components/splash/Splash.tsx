import { useEffect, useState } from "react";

const VERSION = "0.1.0";

export default function Splash() {
  const [phase, setPhase] = useState<"enter" | "visible" | "exit">("enter");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("visible"), 50);
    const t2 = setTimeout(() => setPhase("exit"), 7500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <div className="splash-root w-full h-full flex flex-col overflow-hidden">
      {/* Main content area */}
      <div
        className="flex-1 flex items-center pl-12 transition-all duration-700 ease-out"
        style={{
          opacity: phase === "enter" ? 0 : phase === "exit" ? 0 : 1,
          transform: phase === "enter" ? "translateY(10px)" : phase === "exit" ? "translateY(-10px)" : "translateY(0)",
        }}
      >
        <img
          src="/koring-licon.svg"
          alt="Koring Launcher"
          className="splash-logo w-[260px] h-auto"
        />
      </div>

      {/* Bottom bar */}
      <div className="flex items-center justify-between px-6 pb-4 text-xs splash-muted">
        <span>Provided by Lingke Koring Studio</span>
        <span>v{VERSION}</span>
      </div>

      <style>{`
        .splash-root {
          background: var(--splash-bg);
        }
        .splash-logo {
          fill: var(--splash-fg);
        }
        .splash-muted {
          color: var(--splash-muted);
        }

        /* Light mode (default) */
        :root {
          --splash-bg: #ffffff;
          --splash-fg: #1a1a2e;
          --splash-muted: #888888;
        }

        /* Dark mode via class */
        .dark {
          --splash-bg: #1a1a2e;
          --splash-fg: #ffffff;
          --splash-muted: #888888;
        }

        /* System dark mode */
        @media (prefers-color-scheme: dark) {
          :root:not(.light) {
            --splash-bg: #1a1a2e;
            --splash-fg: #ffffff;
            --splash-muted: #888888;
          }
        }
      `}</style>
    </div>
  );
}
