import { createElement, useCallback, useEffect } from "react";
import type { MouseEvent } from "react";

/**
 * FlashDuty 状态页徽章（status.koring.space）
 *
 * 官方接入方式是一段 `<script>` + 自定义元素 `<flashduty-status-widget>`：
 * 这里在挂载时把脚本注入 `<head>`（同页只注入一次），再交给 React 渲染自定义元素。
 * 用 `createElement` 而不是 JSX，避免为第三方元素扩全局 JSX 类型。
 *
 * 徽章自身是一个 `<a>`；在桌面端点击时应唤起系统浏览器，而不是在应用内跳转，
 * 所以在外层拦截点击并交给主进程 openExternal。
 */
const SCRIPT_SRC = "https://statuspage.flashcat.cloud/status-page-widget/1.0.1/widget.js";
const SCRIPT_INTEGRITY =
  "sha384-UPNiiTsMdVbjrBGP/eTAW+OBpaWrL5bFa4L0IJkxrGelurQ+sELET6of/tdLcrOn";
const STATUS_PAGE = "https://status.koring.space";
const TAG = "flashduty-status-widget";

function ensureWidgetScript(): void {
  if (typeof document === "undefined") return;
  if (document.querySelector(`script[data-koring-status-widget="true"]`)) return;
  const script = document.createElement("script");
  script.src = SCRIPT_SRC;
  script.async = true;
  script.integrity = SCRIPT_INTEGRITY;
  script.crossOrigin = "anonymous";
  script.dataset.koringStatusWidget = "true";
  document.head.appendChild(script);
}

interface ServiceStatusBadgeProps {
  /** 额外样式类 */
  className?: string;
  /** 主题：auto（跟随系统/应用）或 light / dark */
  theme?: "auto" | "light" | "dark";
  size?: "small" | "medium" | "large";
  /** 点击目标，默认打开 status.koring.space */
  href?: string;
}

export function ServiceStatusBadge({
  className,
  theme = "auto",
  size = "small",
  href = STATUS_PAGE,
}: ServiceStatusBadgeProps) {
  useEffect(() => {
    ensureWidgetScript();
  }, []);

  const handleClick = useCallback(
    (event: MouseEvent<HTMLSpanElement>) => {
      // 拦下徽章内部 <a> 的默认导航，改用系统浏览器打开
      event.preventDefault();
      event.stopPropagation();
      window.electronAPI?.openExternal(href);
    },
    [href],
  );

  return (
    <span
      className={className}
      onClick={handleClick}
      style={{ display: "inline-flex", alignItems: "center", cursor: "pointer" }}
    >
      {createElement(TAG, {
        page: STATUS_PAGE,
        type: "badge",
        theme,
        locale: "zh",
        size,
      })}
    </span>
  );
}
