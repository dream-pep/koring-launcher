import { EmptyState } from "@heroui/react";
import { Languages } from "lucide-react";
import { PageHeader } from "@/components/setting";

export function LangSetting() {
  return (
    <div>
      <PageHeader title="语言" desc="选择启动器界面的显示语言与地区偏好" />
      <EmptyState className="py-16">
        <Languages className="w-10 h-10 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground mt-3">该功能正在开发中</p>
      </EmptyState>
    </div>
  );
}
