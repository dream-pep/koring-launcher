/**
 * 背景图处理服务（主进程，程序本体资源管理）。
 *
 * 职责：
 * 1. 把用户自选的大图背景降采样/重编码后**落盘**（只生成屏幕所需尺寸），
 *    返回**文件路径**（供配置文件以路径形式存储，不再使用 BASE64 dataURL）；
 * 2. 提供壁纸文件定位/安全校验工具，供 `koring-res://` 协议处理器使用
 *    （仅允许访问 userData 目录下 `background-custom*` 白名单文件，防目录穿越）。
 */

import electron from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from './logger';

const { nativeImage } = electron;

const log = createLogger('background-image');

export interface OptimizedBackground {
  /** 实际使用的文件路径（优化后文件；无需优化时为原始缓存文件） */
  filePath: string;
  bytes: number;
  width: number;
  height: number;
  /** 是否发生了降采样/重编码 */
  optimized: boolean;
}

const EXT_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
};

const MIME_TO_EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/bmp': '.bmp',
};

/**
 * 旧版配置若仍存 BASE64 dataURL 且 userData 里没有原始缓存文件时，
 * 直接把 dataURL 解码落盘为 `background-custom-<唯一后缀><ext>`，
 * 保证配置文件能迁移为「文件路径」存储。
 */
export function recoverBackgroundFromDataUrl(dataUrl: string, userDataDir: string): string | null {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl.trim());
  if (!match) return null;
  const ext = MIME_TO_EXT[match[1].toLowerCase()] ?? '.png';
  try {
    const buffer = Buffer.from(match[2], 'base64');
    if (!buffer || buffer.length === 0) return null;
    if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true });
    clearStaleBackgroundFiles(userDataDir, []);
    const rawPath = path.join(userDataDir, `background-custom-${uniqueSuffix()}${ext}`);
    fs.writeFileSync(rawPath, buffer);
    return rawPath;
  } catch {
    return null;
  }
}

/** 透明通道源格式：优化时用 PNG 无损编码，避免破坏透明背景 */
const TRANSPARENT_MIMES = new Set(['image/png', 'image/webp', 'image/gif']);

export function mimeForExt(ext: string): string {
  return EXT_MIME[ext.toLowerCase()] || 'image/png';
}

export function mimeForFile(filePath: string): string {
  return mimeForExt(path.extname(filePath));
}

function statSize(p: string): number {
  try {
    return fs.statSync(p).size;
  } catch {
    return 0;
  }
}

/** 生成唯一后缀：每次导入的文件名都不同，保证渲染端 URL/配置路径变化以触发实时刷新与渐入动效 */
function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** 删除 userData 目录里旧的壁纸缓存文件（保留 keep 中列出的完整路径） */
export function clearStaleBackgroundFiles(userDataDir: string, keep: string[]): void {
  try {
    const entries = fs.readdirSync(userDataDir);
    const keepSet = new Set(keep.map((p) => path.basename(p)));
    for (const name of entries) {
      if (!name.startsWith('background-custom')) continue;
      if (keepSet.has(name)) continue;
      const full = path.join(userDataDir, name);
      try {
        fs.unlinkSync(full);
      } catch {
        // 忽略删除失败（其它文件占用等）
      }
    }
  } catch {
    // userData 目录不存在等
  }
}

/**
 * 对已复制到 userData 的原始壁纸做「按需」降采样，结果直接落盘。
 * - 长边 ≤ maxEdge：不需要优化 → 直接返回原始缓存文件路径（零损耗，视觉 100% 一致）；
 * - 长边 > maxEdge：等比 resize → JPEG(q0.9) 或 PNG(透明/动画不处理) 写为
 *   `background-custom-opt-<唯一后缀>.<ext>`（文件名每次不同，便于渲染端感知变化并做渐入），
 *   同时清理旧的其它格式 opt 文件；
 * - 动画 GIF 或无法解析：原样返回原始路径（不破坏动画/内容）。
 */
export function optimizeBackgroundFile(rawFilePath: string, maxEdge = 4096): OptimizedBackground {
  const fail = (filePath: string): OptimizedBackground => {
    let width = 0;
    let height = 0;
    try {
      const s = nativeImage.createFromPath(filePath).getSize();
      width = s.width || 0;
      height = s.height || 0;
    } catch {
      // 无法读取尺寸时按 0 处理
    }
    return {
      filePath,
      bytes: statSize(filePath),
      width,
      height,
      optimized: false,
    };
  };

  const outDir = path.dirname(rawFilePath);
  const rawExt = path.extname(rawFilePath).toLowerCase();
  const mime = mimeForExt(rawExt);

  try {
    // 动画 GIF：nativeImage 只能解码首帧，不处理，保持原样
    if (mime === 'image/gif') {
      return fail(rawFilePath);
    }

    const image = nativeImage.createFromPath(rawFilePath);
    if (image.isEmpty()) return fail(rawFilePath);

    const size = image.getSize();
    const longEdge = Math.max(size.width, size.height);
    if (longEdge <= maxEdge || size.width <= 0 || size.height <= 0) {
      // 无需优化：清掉历史遗留的旧 opt/其它扩展名缓存后原样返回
      clearStaleBackgroundFiles(outDir, [rawFilePath]);
      return {
        filePath: rawFilePath,
        bytes: statSize(rawFilePath),
        width: size.width,
        height: size.height,
        optimized: false,
      };
    }

    const scale = maxEdge / longEdge;
    const w = Math.max(1, Math.round(size.width * scale));
    const h = Math.max(1, Math.round(size.height * scale));
    const output = image.resize({ width: w, height: h, quality: 'best' });
    if (output.isEmpty()) return fail(rawFilePath);

    const outSize = output.getSize();
    const hasTransparency = TRANSPARENT_MIMES.has(mime);
    const outExt = hasTransparency ? '.png' : '.jpg';
    const outMime = hasTransparency ? 'image/png' : 'image/jpeg';

    let buffer: Buffer;
    if (hasTransparency) {
      buffer = output.toPNG();
    } else {
      buffer = output.toJPEG(90);
    }
    if (!buffer || buffer.length === 0) return fail(rawFilePath);

    // 先清理旧文件，再原子写入新文件（文件名带唯一后缀，保证每次导入路径都不同）
    clearStaleBackgroundFiles(outDir, [rawFilePath]);
    const optPath = path.join(outDir, `background-custom-opt-${uniqueSuffix()}${outExt}`);
    const tmpPath = `${optPath}.${process.pid}.tmp`;
    fs.writeFileSync(tmpPath, buffer);
    try {
      fs.renameSync(tmpPath, optPath);
    } catch {
      fs.unlinkSync(tmpPath);
      fs.writeFileSync(optPath, buffer);
    }

    return {
      filePath: optPath,
      bytes: buffer.length,
      width: outSize.width,
      height: outSize.height,
      optimized: true,
    };
  } catch {
    return fail(rawFilePath);
  }
}

/**
 * 复制用户选择的图片到 userData（原始缓存，命名 background-custom-<唯一后缀><ext>），
 * 清理旧缓存，然后返回优化结果。每次导入文件名都不同 → 配置里的路径必然变化，
 * 渲染端据此实时刷新并触发切换渐入动效。
 */
export function importUserBackground(srcPath: string, maxEdge = 4096): OptimizedBackground | null {
  try {
    if (!fs.existsSync(srcPath) || !fs.statSync(srcPath).isFile()) return null;
    const userDataDir = electron.app.getPath('userData');
    if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true });

    const ext = path.extname(srcPath).toLowerCase() || '.png';
    const rawPath = path.join(userDataDir, `background-custom-${uniqueSuffix()}${ext}`);
    // 删除旧的原始缓存
    clearStaleBackgroundFiles(userDataDir, []);
    fs.copyFileSync(srcPath, rawPath);
    const result = optimizeBackgroundFile(rawPath, maxEdge);
    if (result) {
      log.info(`导入壁纸完成 → ${path.basename(result.filePath)} (${result.width}x${result.height}, ${result.bytes}B, optimized=${result.optimized})`);
    }
    return result;
  } catch (e) {
    log.error('导入壁纸失败:', e);
    return null;
  }
}

/** 找到 userData 中最近的壁纸缓存原始文件（不含 opt 变体） */
export function findCachedBackgroundRaw(userDataDir: string): string | null {
  try {
    const entries = fs.readdirSync(userDataDir);
    const files = entries
      .filter((n) => n.startsWith('background-custom') && !n.includes('-opt'))
      .map((n) => path.join(userDataDir, n))
      .filter((p) => {
        try {
          return fs.statSync(p).isFile();
        } catch {
          return false;
        }
      });
    if (files.length === 0) return null;
    files.sort((a, b) => {
      try {
        return fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs;
      } catch {
        return 0;
      }
    });
    return files[0];
  } catch {
    return null;
  }
}

/** 目标路径是否真实地位于 root 之内（realpath 后比较，防符号链接/目录穿越） */
export function isPathInside(root: string, target: string): boolean {
  try {
    const realRoot = fs.realpathSync(root);
    const realTarget = fs.realpathSync(target);
    const rel = path.relative(realRoot, realTarget);
    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
  } catch {
    return false;
  }
}

/** 是否为受管壁纸文件（供协议处理器白名单使用） */
export function isManagedBackgroundFile(fileName: string): boolean {
  return fileName.startsWith('background-custom');
}
