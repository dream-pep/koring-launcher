import { EmptyState } from "@heroui/react";
import { Globe } from "lucide-react";
import { PageHeader } from "@/components/setting";

export function EtherOnlineSetting() {
  return (
    <div>
      <PageHeader title="以太联机" desc="配置以太联机服务，实现多人局域网或远程联机" />
      <EmptyState className="py-16">
        <Globe className="w-10 h-10 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground mt-3">该功能正在开发中</p>
      </EmptyState>
    </div>
  );
}
