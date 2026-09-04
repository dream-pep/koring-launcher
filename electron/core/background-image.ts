/**
 * 背景图处理服务（主进程，程序本体资源管理）。
 *
 * 目标：把用户自选的大图背景在进入渲染进程前，降采样到
 * 「窗口实际需要」的尺寸（长边按 maxEdge 限制），从而避免
 * 数 MB～数十 MB 的原图以 base64 + 全分辨率解码的形式常驻内存，
 * 且不改变可见显示效果（超出屏幕物理像素的部分在视觉上不可见）。
 *
 * 规则：
 * - 长边 ≤ maxEdge → 原样返回（零损耗，效果 100% 一致）；
 * - 长边 > maxEdge → 等比 resize 后重编码（JPEG 有损 q0.9 / 带透明通道用 PNG 无损）；
 * - 动画 GIF / 解析失败 / 无法解码 → 返回 null 或原样，由调用方回退到原始文件（不改变现有行为）。
 */

import electron from 'electron';
import * as fs from 'fs';
import * as path from 'path';

const { nativeImage } = electron;

export interface PreparedBackground {
  dataUrl: string | null;
  bytes: number;
  width: number;
  height: number;
  optimized: boolean;
}

const MIME_MAP: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
};

const TRANSPARENT_MIMES = new Set(['image/png', 'image/webp', 'image/gif']);

function bufferToDataUrl(buffer: Buffer, mime: string): string {
  return `data:${mime};base64,${buffer.toString('base64')}`;
}

/**
 * 解析并（按需）优化背景图片，返回可直接给 CSS 使用的 data URL。
 * @param srcPath 原图文件路径
 * @param maxEdge 目标长边上限（像素），默认 4096
 */
export function prepareBackgroundImage(srcPath: string, maxEdge = 4096): PreparedBackground | null {
  const raw: PreparedBackground = { dataUrl: null, bytes: 0, width: 0, height: 0, optimized: false };
  try {
    const buffer = fs.readFileSync(srcPath);
    const ext = path.extname(srcPath).toLowerCase();
    const mime = MIME_MAP[ext] || 'image/png';

    // 动画 GIF：nativeImage 只能解码首帧，直接原样返回，避免破坏动画
    if (mime === 'image/gif') {
      raw.dataUrl = bufferToDataUrl(buffer, mime);
      raw.bytes = buffer.length;
      return raw;
    }

    const image = nativeImage.createFromBuffer(buffer);
    if (image.isEmpty()) return null;

    const size = image.getSize();
    const longEdge = Math.max(size.width, size.height);
    const needResize = longEdge > maxEdge && size.width > 0 && size.height > 0;

    // 仅当确实需要降尺寸时才做重编码（视觉零影响的边界：超出屏幕物理像素的部分不可见）；
    // 未超限但体积大的图原样返回，避免任何有损重编码改变显示效果。
    if (!needResize) {
      raw.dataUrl = bufferToDataUrl(buffer, mime);
      raw.bytes = buffer.length;
      raw.width = size.width;
      raw.height = size.height;
      return raw;
    }

    let output = image;
    const scale = maxEdge / longEdge;
    const w = Math.max(1, Math.round(size.width * scale));
    const h = Math.max(1, Math.round(size.height * scale));
    output = image.resize({ width: w, height: h, quality: 'best' });
    if (output.isEmpty()) return null;

    const outSize = output.getSize();
    const hasTransparency = TRANSPARENT_MIMES.has(mime);
    let outBuffer: Buffer;
    let outMime: string;
    if (hasTransparency) {
      outBuffer = output.toPNG();
      outMime = 'image/png';
    } else {
      outBuffer = output.toJPEG(90);
      outMime = 'image/jpeg';
    }
    if (outBuffer.length === 0) return null;

    raw.dataUrl = bufferToDataUrl(outBuffer, outMime);
    raw.bytes = outBuffer.length;
    raw.width = outSize.width;
    raw.height = outSize.height;
    raw.optimized = true;
    return raw;
  } catch {
    return null;
  }
}
