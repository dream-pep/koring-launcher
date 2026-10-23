//  __         __     __   __     ______     __  __     ______        __   __     ______     ______
// /\ \       /\ \   /\ "-.\ \   /\  ___\   /\ \/ /    /\  ___\      /\ "-.\ \   /\  ___\   /\__  _\
// \ \ \____  \ \ \  \ \ \-.  \  \ \ \__ \  \ \  _"-.  \ \  __\      \ \ \-.  \  \ \  __\   \/_/\ \/
//  \ \_____\  \ \_\  \ \_\\"\_\  \ \_____\  \ \_\ \_\  \ \_____\     \ \_\\"\_\  \ \_____\    \ \_\
//   \/_____/   \/_/   \/_/ \/_/   \/_____/   \/_/\/_/   \/_____/      \/_/ \/_/   \/_____/     \/_/
//
// 所有权利归Lingke Network (china)所有 | dream_pep拥有其艺术改变权力
// 未经允许的情况下删除此版权头可能会受到民事指控
// 请勿在未经Lingke Network (china)允许的范围内修改代码并分发

import { Gamepad2 } from "lucide-react";
import clsx from "clsx";
import { ManagedImage } from "@/resources/ManagedImage";
import type { InstanceIconInfo } from "@/api/instance";

/**
 * 由实例名推导默认图标的色相：同一实例名永远得到同一个颜色，
 * 没有 logo.png 时也能一眼区分不同实例。
 */
function hueFromName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) % 360;
  }
  return hash;
}

interface InstanceIconProps {
  /** 实例名（同时作为资源缓存 key 的一部分） */
  name: string;
  icon?: InstanceIconInfo | null;
  /** 尺寸与圆角等外框样式，例如 "w-14 h-14 rounded-2xl" */
  className?: string;
  /** 默认图标里的游戏手柄大小 */
  iconClassName?: string;
}

/**
 * 实例图标：实例目录里有 logo.png（或 icon.png 等候选文件）时用图片，
 * 否则回退到按名称取色的默认图标。
 */
export function InstanceIcon({ name, icon, className, iconClassName }: InstanceIconProps) {
  const hue = hueFromName(name);
  const fallback = (
    <div
      className={clsx(
        "shrink-0 flex items-center justify-center overflow-hidden border border-black/[0.06] dark:border-white/[0.08]",
        className
      )}
      style={{
        backgroundImage: `linear-gradient(135deg, hsl(${hue} 62% 58%), hsl(${(hue + 42) % 360} 58% 44%))`,
      }}
    >
      <Gamepad2 className={clsx("w-1/2 h-1/2 text-white/90", iconClassName)} />
    </div>
  );

  if (!icon?.url) return fallback;

  return (
    <ManagedImage
      source={icon.url}
      // data URL 太长不能当注册表 key；带上 mtime 让换图后自动重新解码
      cacheKey={`instance-icon:${name}:${icon.mtimeMs}`}
      maxDimension={256}
      alt={name}
      className={clsx(
        "shrink-0 object-cover border border-black/[0.06] dark:border-white/[0.08]",
        className
      )}
      loadingFallback={fallback}
      errorFallback={fallback}
    />
  );
}
