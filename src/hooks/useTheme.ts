import { useEffect } from "react";
import { useThemeStore } from "@/stores/themeStore";

export function useTheme() {
  const darkMode = useThemeStore((s) => s.darkMode);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");

    const applySync = () => {
      const mode = useThemeStore.getState().darkMode;
      if (mode === "auto") {
        document.documentElement.classList.toggle("dark", mq.matches);
      } else if (mode === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    };

    const applyAuto = async () => {
      const mode = useThemeStore.getState().darkMode;
      if (mode !== "auto") {
        applySync();
        return;
      }
      try {
        const theme = await window.electronAPI?.getTheme();
        if (theme !== null && theme !== undefined) {
          document.documentElement.classList.toggle("dark", theme === "dark");
          return;
        }
      } catch {}
      applySync();
    };

    applyAuto();
    mq.addEventListener("change", applySync);
    return () => mq.removeEventListener("change", applySync);
  }, [darkMode]);
}
