import { EmptyState } from "@heroui/react";
import { Network } from "lucide-react";
import { PageHeader } from "@/components/setting";

export function TawaOnlineSetting() {
  return (
    <div>
      <PageHeader title="陶瓦联机" desc="配置陶瓦联机服务，通过中继服务器进行多人游戏" />
      <EmptyState className="py-16">
        <Network className="w-10 h-10 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground mt-3">该功能正在开发中</p>
      </EmptyState>
    </div>
  );
}
