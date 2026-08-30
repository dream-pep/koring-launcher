import { type ReactNode } from "react";

interface UpvpLayoutProps {
  children: ReactNode;
}

/** 与 OOBE 相同的全屏居中布局框架 */
export function UpvpLayout({ children }: UpvpLayoutProps) {
  return (
    <div className="h-full flex flex-col items-center justify-center relative">
      {children}
    </div>
  );
}
