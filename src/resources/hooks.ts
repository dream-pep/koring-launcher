/**
 * 资源管理相关 React hooks。
 */

import { useEffect, useState } from "react";
import { resourceRegistry } from "./registry";
import { decodeImageSource } from "./image";
import type { ImageDecodeOptions } from "./image";

export type ManagedImageStatus = "idle" | "loading" | "ready" | "error";

export interface ManagedImageValue {
  status: ManagedImageStatus;
  /** 可直接用于 <img src> 的 URL（ready 时有效） */
  url: string | null;
}

interface DecodedPayload {
  url: string;
  width: number;
  height: number;
  bytes: number;
}

export interface UseManagedImageOptions extends ImageDecodeOptions {
  /** release 后是否缓存解码结果；默认 true */
  cache?: boolean;
}

/**
 * 管理式图片 hook：经资源注册表加载/缓存图片，组件卸载或源变化时释放引用；
 * 缓存条目被预算逐出时会自动 revokeObjectURL。
 * 注意：effect 依赖仅使用原始值（maxDimension/cache），对象 options 每次渲染新建不影响。
 */
export function useManagedImage(
  source: string | null | undefined,
  options: UseManagedImageOptions = {},
): ManagedImageValue {
  const maxDimension = options.maxDimension ?? 1024;
  const cache = options.cache ?? true;
  const [value, setValue] = useState<ManagedImageValue>({
    status: source ? "loading" : "idle",
    url: null,
  });

  useEffect(() => {
    if (!source) {
      setValue({ status: "idle", url: null });
      return;
    }
    let alive = true;
    const key = `image:${maxDimension}:${source}`;
    setValue({ status: "loading", url: null });

    resourceRegistry
      .acquire<DecodedPayload>(key, "image", {
        cache,
        bytes: 0,
        load: async () => {
          const decoded = await decodeImageSource(source, { maxDimension });
          if (!decoded) return null;
          return {
            url: decoded.url,
            width: decoded.width,
            height: decoded.height,
            bytes: decoded.bytes,
          };
        },
        onRelease: (payload) => {
          try {
            URL.revokeObjectURL(payload.url);
          } catch {
            // 释放失败可忽略
          }
        },
      })
      .then((payload) => {
        if (!alive) return;
        if (payload) {
          resourceRegistry.setBytes(key, payload.bytes);
          setValue({ status: "ready", url: payload.url });
        } else {
          setValue({ status: "error", url: null });
        }
      });

    return () => {
      alive = false;
      resourceRegistry.release(key);
    };
  }, [source, maxDimension, cache]);

  return value;
}
