/**
 * ManagedImage：经资源管理服务加载/缓存/降采样的 <img>。
 * 供启动器程序本体 UI（实例图标、资源图标等列表）复用；
 * 当前尚未被线上页面接入（占位页面保持原样），作为通用组件交付。
 */

import { type ImgHTMLAttributes, type ReactNode } from "react";
import { useManagedImage } from "./hooks";

export interface ManagedImageProps
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> {
  /** 图源：http(s) / blob: / data: */
  source: string;
  /** 目标长边上限（超过则降采样，默认 1024） */
  maxDimension?: number;
  /** 自定义注册表 key（源很长时必传，例如实例图标的 data URL） */
  cacheKey?: string;
  /** 加载中占位（默认无） */
  loadingFallback?: ReactNode;
  /** 失败占位（默认无） */
  errorFallback?: ReactNode;
}

export function ManagedImage({
  source,
  maxDimension,
  cacheKey,
  loadingFallback = null,
  errorFallback = null,
  alt,
  ...rest
}: ManagedImageProps) {
  const { status, url } = useManagedImage(source, { maxDimension, key: cacheKey });

  if (status === "idle" || status === "loading") {
    return <>{loadingFallback}</>;
  }
  if (status === "error" || !url) {
    return <>{errorFallback}</>;
  }
  return <img src={url} alt={alt ?? ""} loading="lazy" decoding="async" {...rest} />;
}
