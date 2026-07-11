import { type ReactNode } from "react";

interface OobeLayoutProps {
  children: ReactNode;
}

export function OobeLayout({ children }: OobeLayoutProps) {
  return (
    <div className="h-full flex flex-col items-center justify-center relative">
      {children}
    </div>
  );
}
