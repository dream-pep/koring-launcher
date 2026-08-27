// 设置页统一徽章：版本类型 / 加载器 / 状态标签共用一个组件与样式组合。
import { cn } from "@/lib/utils";

export type SettingBadgeVariant = "neutral" | "primary" | "success" | "warning" | "info" | "error" | "violet";

const badgeStyles: Record<SettingBadgeVariant, string> = {
  neutral: "bg-foreground/[0.05] dark:bg-white/[0.05] text-muted-foreground border-border/30 dark:border-white/[0.05]",
  primary: "bg-primary/10 text-primary border-primary/20",
  success: "bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400 border-green-500/20",
  warning: "bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400 border-amber-500/20",
  info: "bg-sky-500/10 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400 border-sky-500/20",
  error: "bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400 border-red-500/20",
  violet: "bg-violet-500/10 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400 border-violet-500/20",
};

export function SettingBadge({
  variant = "neutral",
  className,
  children,
}: {
  variant?: SettingBadgeVariant;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md border font-medium whitespace-nowrap",
        badgeStyles[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
