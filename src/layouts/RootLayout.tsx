import { useEffect, type ReactNode } from "react";
import { BackgroundLayer } from "@/components/background/BackgroundLayer";
import { SystemLayer } from "@/components/system/SystemLayer";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { UpdateAvailableDialog } from "@/components/UpdateAvailableDialog";
import { RuntimeNotices } from "@/components/RuntimeNotices";
import { ActivationGate } from "@/components/ActivationGate";
import { Toaster } from "@/components/ui/sonner";
import { useA11yStore } from "@/stores/a11yStore";
import { installPointerOrigin } from "@/lib/pointer-origin";
import clsx from "clsx";

interface RootLayoutProps {
  children: ReactNode;
  showMinimize?: boolean;
  showMaximize?: boolean;
  showClose?: boolean;
}

export function RootLayout({
  children,
  showMinimize = true,
  showMaximize = true,
  showClose = true,
}: RootLayoutProps) {
  const { reduceMotion, reduceTransparency, highContrast, contentBlurOpacity } = useA11yStore();

  const blurOpacity = reduceTransparency ? 0 : contentBlurOpacity;

  // 记录最近指针位置：弹层「从触发位置长出来」的 transform-origin 依赖它
  useEffect(() => {
    installPointerOrigin();
  }, []);

  return (
    <div
      className={clsx(
        "relative w-screen h-screen overflow-hidden",
        reduceMotion && "reduce-motion",
        reduceTransparency && "reduce-transparency",
        highContrast && "high-contrast",
      )}
      style={{ "--content-blur-opacity": `${blurOpacity / 100}` } as React.CSSProperties}
    >
      {/* Layer 0: Background */}
      <BackgroundLayer />

      {/* Layer 1: Content */}
      <div
        id="app-content-scroll"
        className="absolute z-[1] left-0 right-0 bottom-0 top-[40px] overflow-auto"
        style={{ viewTransitionName: "content" } as React.CSSProperties}
      >
        {children}
      </div>

      {/* Layer 100: System (titlebar + window controls) */}
      <SystemLayer
        showMinimize={showMinimize}
        showMaximize={showMaximize}
        showClose={showClose}
      />

      {/* Global confirm dialog */}
      <ConfirmDialog />

      {/* 全局：发现新版本弹窗（检查到新版本时自动弹出） */}
      <UpdateAvailableDialog />

      {/* 运行时提示（Linux AppImage 未解包安装等） */}
      <RuntimeNotices />

      {/* 启动通知（设备 + 版本）与激活门禁（黑名单 / 禁激活 / 强制升级） */}
      <ActivationGate />

      {/* Sonner toaster：样式与默认时长见 components/ui/sonner.tsx 与 lib/toast.ts */}
      <Toaster />
    </div>
  );
}
