import { formatRoomCodeInput } from "@/api/terracotta";
import { cn } from "@/lib/utils";
import { CopyButton } from "./CopyButton";

/** 大号等宽房间码 + 复制按钮；尚未分配时给占位文案 */
export function RoomCodeDisplay({
  code,
  label = "房间码",
  compact = false,
  className,
}: {
  code: string;
  label?: string;
  compact?: boolean;
  className?: string;
}) {
  const formatted = formatRoomCodeInput(code);

  if (!formatted) {
    return (
      <div
        className={cn(
          "rounded-xl border border-dashed border-border/50 dark:border-white/[0.08] px-4 py-3",
          className,
        )}
      >
        <p className="text-[11px] tracking-wider text-muted-foreground uppercase">{label}</p>
        <p className="mt-1 text-[13px] text-muted-foreground">正在分配房间码…</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-border/40 dark:border-white/[0.08] bg-foreground/[0.03] px-4 py-3",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] tracking-wider text-muted-foreground uppercase">{label}</p>
          <p
            className={cn(
              "mt-1 break-all font-mono font-semibold tracking-[0.06em] text-foreground",
              compact ? "text-[17px]" : "text-[24px] leading-tight",
            )}
          >
            {formatted}
          </p>
        </div>
        <CopyButton text={formatted} className="mt-3" />
      </div>
    </div>
  );
}
