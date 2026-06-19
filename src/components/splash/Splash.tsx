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
    <div style={{
      width: "100%",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      background: "var(--splash-bg)",
    }}>
      {/* Centered logo */}
      <div style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: phase === "enter" ? 0 : phase === "exit" ? 0 : 1,
        transform: phase === "enter" ? "translateY(10px)" : phase === "exit" ? "translateY(-10px)" : "translateY(0)",
        transition: "all 0.7s ease-out",
      }}>
        <img
          src="/koring-licon.svg"
          alt="Koring Launcher"
          className="splash-logo"
          style={{ width: 260, height: "auto" }}
        />
      </div>

      {/* Bottom bar */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px 16px",
        fontSize: 12,
        color: "var(--splash-muted)",
      }}>
        <span>Provided by Lingke Koring Studio</span>
        <span>v{VERSION}</span>
      </div>

      <style>{`
        :root {
          --splash-bg: #ffffff;
          --splash-muted: #888888;
        }
        .dark {
          --splash-bg: #1a1a2e;
          --splash-muted: #888888;
        }
        @media (prefers-color-scheme: dark) {
          :root:not(.light) {
            --splash-bg: #1a1a2e;
            --splash-muted: #888888;
          }
        }
        .splash-logo {
          filter: none;
        }
        .dark .splash-logo {
          filter: invert(1);
        }
        @media (prefers-color-scheme: dark) {
          :root:not(.light) .splash-logo {
            filter: invert(1);
          }
        }
      `}</style>
    </div>
  );
}
