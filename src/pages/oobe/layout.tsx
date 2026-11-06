import { type ReactNode } from "react";
import { WizardLayout } from "@/components/wizard-layout";

interface OobeLayoutProps {
  children: ReactNode;
}

/** OOBE 步骤布局（与 UPVP 共用同一套向导布局框架） */
export function OobeLayout({ children }: OobeLayoutProps) {
  return <WizardLayout>{children}</WizardLayout>;
}
