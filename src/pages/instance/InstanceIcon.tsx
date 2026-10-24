import { useState } from "react";
import clsx from "clsx";
import { Gamepad2 } from "lucide-react";
import type { InstanceIconInfo } from "@/api/instance";

interface InstanceIconProps {
  name: string;
  icon?: InstanceIconInfo | null;
  className?: string;
  iconClassName?: string;
}

/** 实例图标：有 logo.png → 显示图片，否则回退游戏手柄图标 */
export function InstanceIcon({ name, icon, className, iconClassName }: InstanceIconProps) {
  const [failed, setFailed] = useState(false);
  const url = icon?.url && !failed ? icon.url : null;

  return (
    <div
      className={clsx(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl",
        "bg-foreground/[0.05] dark:bg-white/[0.06]",
        className
      )}
    >
      {url ? (
        <img
          src={url}
          alt={name}
          className={clsx("h-full w-full object-cover", iconClassName)}
          onError={() => setFailed(true)}
        />
      ) : (
        <Gamepad2 className={clsx("text-muted-foreground/35", iconClassName ?? "h-1/2 w-1/2")} />
      )}
    </div>
  );
}
