import { EmptyState } from "@heroui/react";
import { Gamepad2 } from "lucide-react";
import { PageHeader } from "@/components/setting";

export function GameAccountSetting() {
  return (
    <div>
      <PageHeader title="游戏账户&档案" desc="管理 Minecraft 游戏内账户、正版验证与游戏档案配置" />
      <EmptyState className="py-16">
        <Gamepad2 className="w-10 h-10 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground mt-3">该功能正在开发中</p>
      </EmptyState>
    </div>
  );
}
