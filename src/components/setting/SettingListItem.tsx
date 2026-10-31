// 设置页列表项容器：版本行 / 扫描结果行等可操作列表项的统一外观。
import { cn } from "@/lib/utils";

interface SettingListItemProps {
  className?: string;
  children: React.ReactNode;
  /** 选中态（高亮边框） */
  selected?: boolean;
  /** 传入后渲染为可点击的列表项（整行 button） */
  onClick?: () => void;
  disabled?: boolean;
  /** 原生 title（悬停提示） */
  title?: string;
}

export function SettingListItem({
  className,
  children,
  selected = false,
  onClick,
  disabled = false,
  title,
}: SettingListItemProps) {
  const classes = cn(
    "flex items-center gap-3 px-3 py-2 rounded-xl border",
    "bg-foreground/[0.03] dark:bg-white/[0.03]",
    selected
      ? "border-primary/30 bg-primary/[0.04]"
      : "border-black/[0.06] dark:border-white/[0.07]",
    className,
  );

  if (onClick) {
    return (
      <button
        type="button"
        title={title}
        disabled={disabled}
        onClick={onClick}
        className={cn(
          classes,
          "w-full text-left transition-colors disabled:cursor-default disabled:opacity-60",
          !selected && !disabled && "hover:border-black/[0.1] hover:bg-foreground/[0.06] dark:hover:border-white/[0.12] dark:hover:bg-white/[0.06]",
        )}
      >
        {children}
      </button>
    );
  }

  return (
    <div title={title} className={classes}>
      {children}
    </div>
  );
}
