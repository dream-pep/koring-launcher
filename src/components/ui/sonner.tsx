import { Toaster as Sonner, type ToasterProps } from "sonner";
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from "lucide-react";
import { useIsDark } from "@/hooks/useIsDark";

/**
 * 全局通知容器（唯一挂载点，见 RootLayout）。
 *
 * 设计：
 * - 表面与项目其他浮层一致（popover + 磨砂 + 细边框 + 柔阴影），不再用 sonner 的 richColors；
 * - 状态语义靠图标底色区分（成功/错误/警告/信息/加载），标题与描述保持正文色层级；
 * - 进出场用 spring 曲线，减少动画时只保留透明度（见 index.css）；
 * - 默认时长由 `@/lib/toast` 按类型给定，这里不再全局 `duration={Infinity}`。
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const isDark = useIsDark();

  return (
    <Sonner
      theme={isDark ? "dark" : "light"}
      position="bottom-right"
      offset={16}
      gap={10}
      visibleToasts={4}
      expand
      closeButton={false}
      richColors={false}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "14px",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
          icon: "cn-toast-icon",
          title: "cn-toast-title",
          description: "cn-toast-desc",
          actionButton: "cn-toast-action",
          cancelButton: "cn-toast-cancel",
          closeButton: "cn-toast-close",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
