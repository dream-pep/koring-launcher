// 设置卡片唯一原语：所有设置子页面卡片统一走这里。
// 基于 HeroUI Surface，用显式类保证确定性的磨砂玻璃外观（与既有设计一致）。
import { Surface } from "@heroui/react";
import { cn } from "@/lib/utils";

export interface SettingSurfaceProps {
  className?: string;
  children?: React.ReactNode;
  /** 是否启用磨砂玻璃（尊重无障碍 reduce-transparency 的全局降级） */
  frost?: boolean;
  /** 阴影级别：raised 默认、flat 无阴影、bordered 仅边框 */
  variant?: "raised" | "flat" | "bordered";
}

const variantCls = {
  raised: "shadow-sm",
  flat: "shadow-none",
  bordered: "shadow-none",
} as const;

export function SettingSurface({ className, frost = true, variant = "raised", children }: SettingSurfaceProps) {
  return (
    <Surface
      variant="transparent"
      className={cn(
        "rounded-xl",
        "bg-white/85 dark:bg-black/45",
        "border border-black/[0.06] dark:border-white/[0.07]",
        variantCls[variant],
        frost && "backdrop-blur-[12px]",
        className,
      )}
    >
      {children}
    </Surface>
  );
}
