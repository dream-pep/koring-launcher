import { type ReactNode } from "react";
import { BackgroundLayer } from "@/components/background/BackgroundLayer";
import { SystemLayer } from "@/components/system/SystemLayer";
import { useA11yStore } from "@/stores/a11yStore";
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
    </div>
  );
}
