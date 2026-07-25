import { EmptyState } from "@heroui/react";
import { MessageSquareHeart } from "lucide-react";
import { PageHeader } from "@/components/setting";

export function FeedbackSetting() {
  return (
    <div>
      <PageHeader title="服务与反馈" desc="提交问题反馈、功能建议与联系开发团队" />
      <EmptyState className="py-16">
        <MessageSquareHeart className="w-10 h-10 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground mt-3">该功能正在开发中</p>
      </EmptyState>
    </div>
  );
}
