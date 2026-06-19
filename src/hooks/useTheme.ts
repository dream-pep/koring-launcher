import { useEffect } from "react";

export function useTheme() {
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");

    const apply = (dark: boolean) => {
      document.documentElement.classList.toggle("dark", dark);
    };

    // 初始应用
    apply(mq.matches);

    // 监听系统切换
    const handler = (e: MediaQueryListEvent) => apply(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
}
