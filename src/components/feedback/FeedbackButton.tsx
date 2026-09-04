// 定制反馈按钮（HeroUI）：点击后用系统浏览器打开 YouTrack 反馈表单直链。
import { ComponentProps } from "react";
import { Button } from "@heroui/react";
import { MessageSquareHeart, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const FORM_DIRECT_URL = "https://lingke.youtrack.cloud/form/aa6a005d-2559-4e92-a0f5-d3898f377ef8";

type FeedbackButtonProps = {
  /** 按钮文案，默认「意见反馈」 */
  label?: string;
} & Omit<ComponentProps<typeof Button>, "children">;

export function FeedbackButton({ label = "意见反馈", ...buttonProps }: FeedbackButtonProps) {
  const openFeedback = async () => {
    try {
      await window.electronAPI?.openExternal(FORM_DIRECT_URL);
    } catch {
      toast.error("无法打开反馈页面，请稍后重试");
    }
  };

  return (
    <Button variant="primary" size="md" onPress={openFeedback} {...buttonProps}>
      <MessageSquareHeart className="w-4 h-4" />
      {label}
      <ExternalLink className="w-3 h-3 opacity-70" />
    </Button>
  );
}
