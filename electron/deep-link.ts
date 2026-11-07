import electron from 'electron';
import { ipcMain } from 'electron';
import { createLogger } from './core/logger';

const log = createLogger('deep-link');

/** 自定义协议名：koring://room-join?code=U/xxxx-xxxx-xxxx-xxxx */
export const DEEP_LINK_PROTOCOL = 'koring';

/** 渲染端订阅的房间加入事件通道 */
export const DEEP_LINK_ROOM_JOIN_CHANNEL = 'deep-link:room-join';

export interface RoomJoinPayload {
  type: 'room-join';
  /** 房间码（保留 U/ 前缀与连字符的原始格式，主进程不再加工） */
  code: string;
  /** 每次投递的唯一 id，渲染端按 id 去重（事件 + 队列消费可能重复投递） */
  id: string;
}

export type DeepLinkPayload = RoomJoinPayload;

type WindowRef = { mainWindow: electron.BrowserWindow | null };

let sequence = 0;

/** 尚未投递给渲染端的深链（启动早期到达、或窗口还没加载完时排队） */
const pending: DeepLinkPayload[] = [];

/** 从命令行参数中挑出第一个 koring:// 链接（Windows 通过 argv 传入） */
export function findDeepLink(argv: readonly string[]): string | null {
  for (const arg of argv) {
    if (typeof arg === 'string' && arg.toLowerCase().startsWith(`${DEEP_LINK_PROTOCOL}://`)) {
      return arg;
    }
  }
  return null;
}

/** 解析深链；不认识的链接返回 null（避免把任意 URL 当成指令） */
export function parseDeepLink(raw: string): DeepLinkPayload | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== `${DEEP_LINK_PROTOCOL}:`) return null;

  // koring://room-join?code=xxx → host=room-join；兼容 koring:///room-join 写法则看 pathname
  const route = `${url.host}${url.pathname}`.replace(/^\/+|\/+$/g, '').toLowerCase();
  if (route !== 'room-join') return null;

  const code = (url.searchParams.get('code') ?? '').trim();
  if (!code) return null;

  sequence += 1;
  return { type: 'room-join', code, id: `${Date.now()}-${sequence}` };
}

function isRendererReady(winRef: WindowRef): boolean {
  const target = winRef.mainWindow;
  return Boolean(target && !target.isDestroyed() && !target.webContents.isLoading());
}

function focusMainWindow(winRef: WindowRef): void {
  const target = winRef.mainWindow;
  if (!target || target.isDestroyed()) return;
  if (target.isMinimized()) target.restore();
  target.show();
  target.focus();
}

/**
 * 把深链交给渲染端：
 * - 窗口已加载完成 → 直接 send 事件；
 * - 否则先入队，等 `flushDeepLinks()`（did-finish-load 后）或渲染端主动 `deep-link:consume` 取走。
 * 队列里的条目不会因为 send 而移除，消费由渲染端按 id 去重，避免「事件 + 队列」双投递导致重复加入。
 */
export function dispatchDeepLink(payload: DeepLinkPayload, winRef: WindowRef): void {
  pending.push(payload);
  if (isRendererReady(winRef)) {
    winRef.mainWindow?.webContents.send(DEEP_LINK_ROOM_JOIN_CHANNEL, payload);
    focusMainWindow(winRef);
    log.info(`深链已投递：${payload.type} code=${payload.code}`);
  } else {
    log.info(`深链已排队（窗口未就绪）：${payload.type} code=${payload.code}`);
  }
}

/** 处理一条原始深链字符串；无法识别时仅记日志 */
export function handleDeepLink(raw: string, winRef: WindowRef): void {
  const payload = parseDeepLink(raw);
  if (!payload) {
    log.warn(`无法识别的深链：${raw}`);
    return;
  }
  dispatchDeepLink(payload, winRef);
}

/** 窗口加载完成后把排队的深链重新投递一遍（渲染端按 id 去重） */
export function flushDeepLinks(winRef: WindowRef): void {
  if (!isRendererReady(winRef)) return;
  for (const payload of pending) {
    winRef.mainWindow?.webContents.send(DEEP_LINK_ROOM_JOIN_CHANNEL, payload);
  }
  if (pending.length > 0) {
    focusMainWindow(winRef);
    log.info(`已补投递 ${pending.length} 条排队深链`);
  }
}

/** 渲染端启动时主动取走积压深链（取走后清空，避免无限增长） */
export function registerDeepLinkHandlers(winRef: WindowRef): void {
  ipcMain.handle('deep-link:consume', () => {
    const items = pending.splice(0, pending.length);
    return items;
  });

  // 渲染端就绪信号：主窗口 did-finish-load 后再补投递一次，覆盖「先发事件、后挂监听」的竞态
  winRef.mainWindow?.webContents.on('did-finish-load', () => {
    flushDeepLinks(winRef);
  });
}
