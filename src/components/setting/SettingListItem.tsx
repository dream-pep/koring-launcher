// 设置页列表项容器：版本行 / 扫描结果行等可操作列表项的统一外观。
import { cn } from "@/lib/utils";

export function SettingListItem({
  className,
  children,
  selected = false,
}: {
  className?: string;
  children: React.ReactNode;
  /** 选中态（高亮边框） */
  selected?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-xl border",
        "bg-foreground/[0.03] dark:bg-white/[0.03]",
        selected
          ? "border-primary/30 bg-primary/[0.04]"
          : "border-black/[0.06] dark:border-white/[0.07]",
        className,
      )}
    >
      {children}
    </div>
  );
}
