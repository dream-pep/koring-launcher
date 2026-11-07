import type { ReactNode } from "react";
import { SettingSurface } from "@/components/setting/SettingSurface";
import { cn } from "@/lib/utils";

const toneCls = {
  primary: "bg-primary/10 text-primary",
  success: "bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400",
  warning: "bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400",
  danger: "bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400",
  neutral: "bg-foreground/[0.06] text-muted-foreground",
} as const;

export type StateTone = keyof typeof toneCls;

/**
 * 联机页唯一主卡片外壳：图标 + 标题 + 描述 + 自定义主体 + 操作区。
 * 每种状态只渲染一个 StateCard（waiting 双卡例外，见契约 9.1）。
 */
export function StateCard({
  icon,
  tone = "primary",
  title,
  description,
  children,
  actions,
  className,
}: {
  icon: ReactNode;
  tone?: StateTone;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <SettingSurface className={cn("p-6 md:p-7", className)}>
      <div className="flex items-start gap-4">
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
            toneCls[tone],
          )}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          {description && (
            <div className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{description}</div>
          )}
          {children && <div className="mt-4">{children}</div>}
          {actions && <div className="mt-5 flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      </div>
    </SettingSurface>
  );
}
