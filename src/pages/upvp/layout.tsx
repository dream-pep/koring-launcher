import { type ReactNode } from "react";
import { WizardLayout } from "@/components/wizard-layout";

interface UpvpLayoutProps {
  children: ReactNode;
}

/** UPVP 步骤布局（与 OOBE 共用同一套向导布局框架） */
export function UpvpLayout({ children }: UpvpLayoutProps) {
  return <WizardLayout>{children}</WizardLayout>;
}
