import { useEffect, useRef, useState } from "react";
import { Button } from "@heroui/react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";

/** 复制文本：navigator.clipboard 不可用时回退到 textarea + execCommand */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 继续走回退方案
  }
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    textarea.style.pointerEvents = "none";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export function CopyButton({
  text,
  label = "复制",
  className,
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  const handleCopy = async () => {
    if (!text) {
      toast.warning("暂无可复制的内容");
      return;
    }
    const ok = await copyToClipboard(text);
    if (!ok) {
      toast.error("复制失败，请手动选择文本复制");
      return;
    }
    setCopied(true);
    toast.success("已复制到剪贴板");
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <Button size="sm" variant="outline" onPress={handleCopy} className={cn("shrink-0", className)}>
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "已复制" : label}
    </Button>
  );
}
