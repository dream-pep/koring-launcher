/**
 * 图片解码管线（渲染端）。
 *
 * 目标：把「远程/本地/Blob 图源」解码为可在 <img>/CSS 使用的对象 URL，
 * 并按显示尺寸降采样，避免大图以原始分辨率常驻内存。
 *
 * 说明：本工具面向启动器程序本体 UI（缩略图/图标列表等），
 * 与 Minecraft 游戏内容无关；当前由 ManagedImage 使用，
 * 尚未被任何线上页面接入（占位页面仍保持原样）。
 */

export interface ImageDecodeResult {
  /** 可直接用于 <img src> / CSS 的 Blob 对象 URL；用完需 revoke */
  url: string;
  width: number;
  height: number;
  /** 产物编码后字节数（估算内存占用用） */
  bytes: number;
  /** 是否实际发生了降采样重编码（false = 原样返回） */
  downscaled: boolean;
}

export interface ImageDecodeOptions {
  /** 目标长边上限（CSS 像素）；小于源图长边时降采样 */
  maxDimension?: number;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** 读取资源并解析为 Blob（http(s)/blob:/data: 均支持） */
export async function fetchBlob(source: string): Promise<Blob | null> {
  try {
    const response = await fetch(source);
    if (!response.ok) return null;
    return await response.blob();
  } catch {
    return null;
  }
}

async function decodeToBitmap(blob: Blob): Promise<ImageBitmap | null> {
  try {
    return await createImageBitmap(blob);
  } catch {
    return null;
  }
}

function isOpaqueMime(type: string): boolean {
  return type !== "image/png" && type !== "image/webp" && type !== "image/gif";
}

/**
 * 解码图片为「长边不超过 maxDimension」的对象 URL。
 * - 源图较小：原样转对象 URL（零损耗，视觉 100% 一致）；
 * - 源图较大：整图解码 → 等比绘制到小画布（编码 JPEG/PNG）→ 转对象 URL，
 *   原始大位图随即 close()，稳态内存远低于让浏览器常驻原始解码。
 * 失败返回 null（调用方自行降级，不抛异常）。
 */
export async function decodeImageSource(
  source: string,
  options: ImageDecodeOptions = {},
): Promise<ImageDecodeResult | null> {
  const maxDimension = clamp(options.maxDimension ?? 1024, 64, 8192);
  try {
    const blob = await fetchBlob(source);
    if (!blob) return null;

    const bitmap = await decodeToBitmap(blob);
    if (!bitmap) return null;

    const { width, height } = bitmap;
    if (width <= 0 || height <= 0) {
      bitmap.close();
      return null;
    }

    const longEdge = Math.max(width, height);
    if (longEdge <= maxDimension) {
      bitmap.close();
      const url = URL.createObjectURL(blob);
      return { url, width, height, bytes: blob.size, downscaled: false };
    }

    const scale = maxDimension / longEdge;
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));

    const canvas = new OffscreenCanvas(targetWidth, targetHeight);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return null;
    }
    ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
    bitmap.close();

    const opaque = isOpaqueMime(blob.type);
    const outBlob = await canvas.convertToBlob({
      type: opaque ? "image/jpeg" : "image/png",
      quality: opaque ? 0.9 : undefined,
    });
    const url = URL.createObjectURL(outBlob);
    return { url, width: targetWidth, height: targetHeight, bytes: outBlob.size, downscaled: true };
  } catch {
    return null;
  }
}

/** 估算 dataURL/字符串占用字节（面板统计用） */
export function estimateDataUrlBytes(value: string | null | undefined): number {
  if (!value) return 0;
  if (value.startsWith("data:")) {
    const comma = value.indexOf(",");
    if (comma > 0) {
      const base64 = value.slice(comma + 1);
      return Math.floor((base64.length * 3) / 4);
    }
  }
  return value.length;
}
