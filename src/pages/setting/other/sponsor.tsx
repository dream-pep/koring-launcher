import { EmptyState } from "@heroui/react";
import { Heart } from "lucide-react";
import { PageHeader } from "@/components/setting";

export function SponsorSetting() {
  return (
    <div>
      <PageHeader title="赞助我们" desc="如果 Koring Launcher 对你有帮助，欢迎赞助支持开发" />
      <EmptyState className="py-16">
        <Heart className="w-10 h-10 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground mt-3">该功能正在开发中</p>
      </EmptyState>
    </div>
  );
}
