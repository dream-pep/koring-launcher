import { useEffect } from "react";
import { useThemeStore } from "@/stores/themeStore";

export function useTheme() {
  const darkMode = useThemeStore((s) => s.darkMode);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");

    const apply = () => {
      const mode = useThemeStore.getState().darkMode;
      let dark = false;
      if (mode === "auto") dark = mq.matches;
      else if (mode === "dark") dark = true;
      document.documentElement.classList.toggle("dark", dark);
    };

    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [darkMode]);
}
