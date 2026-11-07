/**
 * `koring-res://` 自定义协议：让渲染进程以「资源引用」方式使用本地文件
 * （不再把图片以 BASE64 dataURL 传入渲染进程 / 写入配置文件）。
 *
 * 权限/安全约束：
 * - 只允许 host 为 `userdata`，即仅服务 app.getPath('userData') 目录；
 * - 只允许文件名以 `background-custom` 开头的受管壁纸文件（白名单）；
 * - realpath 二次校验目标必须位于 userData 之内（防目录穿越 / 符号链接）；
 * - 以流方式返回文件（stream），渲染进程按需解码，主进程不产生 base64 副本。
 */

import electron from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { Readable } from 'stream';
import { isManagedBackgroundFile, isPathInside, mimeForFile } from './core/background-image';
import { createLogger } from './core/logger';

const { protocol, app } = electron;

const log = createLogger('resource-protocol');

export const RESOURCE_SCHEME = 'koring-res';

/** 必须在 app ready 之前调用（privileged scheme 注册） */
export function registerResourceSchemePrivileges(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: RESOURCE_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
      },
    },
  ]);
}

/** app ready 之后调用：注册协议处理器 */
export function registerResourceProtocol(): void {
  protocol.handle(RESOURCE_SCHEME, async (request) => {
    try {
      const url = new URL(request.url);
      if (url.host !== 'userdata') {
        log.warn(`拒绝非 userdata 主机: ${url.host}`);
        return new Response('Forbidden', { status: 403 });
      }

      let relative: string;
      try {
        relative = decodeURIComponent(url.pathname).replace(/^[/\\]+/, '');
      } catch {
        return new Response('Bad Request', { status: 400 });
      }

      // 路径穿越 / 绝对路径直接拒绝
      if (!relative || relative.includes('..') || path.isAbsolute(relative)) {
        log.warn(`拒绝非法路径: ${relative}`);
        return new Response('Forbidden', { status: 403 });
      }

      const fileName = path.basename(relative);
      if (fileName !== relative || !isManagedBackgroundFile(fileName)) {
        log.warn(`拒绝白名单外文件: ${fileName}`);
        return new Response('Forbidden', { status: 403 });
      }

      const userDataDir = app.getPath('userData');
      const target = path.join(userDataDir, fileName);

      if (!isPathInside(userDataDir, target)) {
        log.warn(`拒绝越权文件: ${target}`);
        return new Response('Forbidden', { status: 403 });
      }

      const stat = await fs.promises.stat(target);
      if (!stat.isFile()) {
        log.warn(`文件不存在: ${target}`);
        return new Response('Not Found', { status: 404 });
      }

      const mime = mimeForFile(target);
      const baseHeaders: Record<string, string> = {
        'content-type': mime,
        'accept-ranges': 'bytes',
        'cache-control': 'no-store',
      };

      // 视频等媒体播放器会带 Range 请求（拖动进度/分段缓冲）→ 返回 206 分片
      const rangeHeader = request.headers.get('range');
      if (rangeHeader) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
        if (match) {
          const total = stat.size;
          let start = match[1] ? Number(match[1]) : 0;
          let end = match[2] ? Number(match[2]) : total - 1;
          if (Number.isFinite(start) && Number.isFinite(end) && start <= end && start < total) {
            end = Math.min(end, total - 1);
            const chunk = fs.createReadStream(target, { start, end });
            const body = Readable.toWeb(chunk) as unknown as BodyInit;
            log.debug(`服务资源分片 ${fileName} [${start}-${end}/${total}] (${mime})`);
            return new Response(body, {
              status: 206,
              headers: {
                ...baseHeaders,
                'content-range': `bytes ${start}-${end}/${total}`,
                'content-length': String(end - start + 1),
              },
            });
          }
        }
        return new Response('Range Not Satisfiable', {
          status: 416,
          headers: { ...baseHeaders, 'content-range': `bytes */${stat.size}` },
        });
      }

      const body = Readable.toWeb(fs.createReadStream(target)) as unknown as BodyInit;
      log.debug(`服务资源 ${fileName} (${stat.size}B, ${mime})`);
      return new Response(body, {
        status: 200,
        headers: {
          ...baseHeaders,
          'content-length': String(stat.size),
        },
      });
    } catch (e) {
      log.error(`协议请求处理失败: ${request.url}`, e);
      return new Response('Not Found', { status: 404 });
    }
  });
}

/** 生成 userData 壁纸文件的协议 URL（fileName 需已通过白名单校验） */
export function backgroundResourceUrl(fileName: string): string {
  return `${RESOURCE_SCHEME}://userdata/${encodeURIComponent(fileName)}`;
}
