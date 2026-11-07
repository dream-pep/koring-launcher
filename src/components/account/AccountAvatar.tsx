import { useState } from "react";
import clsx from "clsx";
import { UserRound } from "lucide-react";

interface AccountAvatarProps {
  /** 头像图片地址（Koring 账户的 picture） */
  picture?: string | null;
  /** 用户名：没有图片时用首字符兜底 */
  name?: string | null;
  /** 直径（px），正方形 */
  size: number;
  className?: string;
  /** 头像框（圆形底）的类名；不传时用默认的前景低透明度底色 */
  frameClassName?: string;
  alt?: string;
}

/**
 * 账户头像：
 * - 有图片 → 圆形裁切显示
 * - 图片加载失败或没有图片 → 用户名首字符
 * - 未登录 → 人形图标
 */
export function AccountAvatar({ picture, name, size, className, frameClassName, alt }: AccountAvatarProps) {
  // 记录加载失败的地址：换账户（picture 变了）后会自动重试新地址
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  const trimmed = name?.trim() ?? "";
  const initial = trimmed ? Array.from(trimmed)[0]!.toUpperCase() : "";
  const showImage = Boolean(picture) && failedSrc !== picture;

  return (
    <span
      className={clsx(
        "relative flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full",
        frameClassName ?? "bg-foreground/[0.08] text-foreground/60",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {showImage ? (
        <img
          src={picture!}
          alt={alt ?? ""}
          draggable={false}
          onError={() => setFailedSrc(picture ?? null)}
          className="h-full w-full object-cover"
        />
      ) : initial ? (
        <span
          className="font-semibold leading-none"
          style={{ fontSize: Math.max(10, Math.round(size * 0.42)) }}
        >
          {initial}
        </span>
      ) : (
        <UserRound style={{ width: size * 0.55, height: size * 0.55 }} strokeWidth={1.8} />
      )}
    </span>
  );
}
