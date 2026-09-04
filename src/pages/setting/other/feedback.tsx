import { MessageSquareHeart } from "lucide-react";
import { PageHeader } from "@/components/setting";
import { FeedbackButton } from "@/components/feedback/FeedbackButton";

export function FeedbackSetting() {
  return (
    <div>
      <PageHeader title="服务与反馈" desc="提交问题反馈、功能建议与联系开发团队" />

      <div className="space-y-6">
        <div className="rounded-xl border border-black/[0.06] dark:border-white/[0.07] bg-white/85 dark:bg-black/45 backdrop-blur-[12px] px-5 py-8 flex flex-col items-center text-center gap-3">
          <div className="w-12 h-12 rounded-full bg-foreground/[0.05] dark:bg-white/[0.05] flex items-center justify-center">
            <MessageSquareHeart className="w-6 h-6 text-muted-foreground/60" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">遇到问题或有建议？</p>
            <p className="text-[12.5px] text-muted-foreground max-w-sm leading-relaxed">
              点击下方按钮，在系统浏览器中打开反馈表单并填写，我们会尽快处理。
            </p>
          </div>
          <FeedbackButton label="填写反馈表单" className="mt-1" />
        </div>

        <div className="rounded-xl border border-black/[0.06] dark:border-white/[0.07] bg-white/85 dark:bg-black/45 backdrop-blur-[12px] px-5 py-4">
          <p className="text-sm font-medium text-foreground">说明</p>
          <ul className="mt-2 space-y-1.5 text-[12.5px] text-muted-foreground leading-relaxed list-disc pl-4">
            <li>反馈表单由 YouTrack 在线表单托管，将在系统默认浏览器中打开。</li>
            <li>提交后的问题与建议将同步至工单系统。</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
