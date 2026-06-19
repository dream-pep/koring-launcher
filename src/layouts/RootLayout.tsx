import { type ReactNode } from "react";
import { BackgroundLayer } from "@/components/background/BackgroundLayer";
import { SystemLayer } from "@/components/system/SystemLayer";

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
  return (
    <div className="relative w-screen h-screen overflow-hidden">
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
