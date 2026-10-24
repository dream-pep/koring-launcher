import { useSyncExternalStore } from "react";

/**
 * 当前是否为暗色主题。
 *
 * 项目没有 next-themes 的 ThemeProvider：主题模式由 themeStore + useTheme 直接
 * 切换 <html class="dark">，因此这里以 HTML 类名为唯一真相源（MutationObserver 订阅），
 * 避免再把 `theme="system"` 交给 sonner 后与用户强制选择的主题不一致。
 */
export function useIsDark(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof document === "undefined") return () => {};
      const observer = new MutationObserver(onChange);
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
      });
      return () => observer.disconnect();
    },
    () =>
      typeof document !== "undefined" &&
      document.documentElement.classList.contains("dark"),
    () => false,
  );
}
