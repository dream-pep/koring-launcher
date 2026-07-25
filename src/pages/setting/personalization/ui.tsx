import { EmptyState } from "@heroui/react";
import { Monitor } from "lucide-react";
import { PageHeader } from "@/components/setting";

export function UiSetting() {
  return (
    <div>
      <PageHeader title="主界面" desc="自定义启动器主界面的布局、模块显示与交互方式" />
      <EmptyState className="py-16">
        <Monitor className="w-10 h-10 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground mt-3">该功能正在开发中</p>
      </EmptyState>
    </div>
  );
}
