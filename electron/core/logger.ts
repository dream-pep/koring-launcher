/**
 * 统一日志（主进程）。
 *
 * 规则：
 * - 默认（非 debug）：warn/error/info 输出到控制台，debug 不输出；
 * - 用户开启「调试模式」（config.advanced.debugMode，设置→游戏→高级）：
 *   debug 也输出控制台，并把全部级别写入 userData/koring.log（超过 5MB 自动轮转为 .old）；
 * - 渲染进程经 `log:write`（ipcRenderer.send）汇入同一套格式/文件。
 */

import electron from 'electron';
import * as fs from 'fs';
import * as path from 'path';

const { ipcMain, app } = electron;

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug: (msg: string, ...args: unknown[]) => void;
  info: (msg: string, ...args: unknown[]) => void;
  warn: (msg: string, ...args: unknown[]) => void;
  error: (msg: string, ...args: unknown[]) => void;
}

const MAX_LOG_BYTES = 5 * 1024 * 1024;

let debugModeProvider: () => boolean = () => false;
export function setDebugModeProvider(fn: () => boolean): void {
  debugModeProvider = fn;
}
export function isDebugMode(): boolean {
  try {
    return debugModeProvider();
  } catch {
    return false;
  }
}

let logStream: fs.WriteStream | null = null;
let cachedFilePath: string | null = null;

export function getLogFilePath(): string | null {
  if (!isDebugMode()) return null;
  if (!cachedFilePath) cachedFilePath = path.join(app.getPath('userData'), 'koring.log');
  return cachedFilePath;
}

function openLogStream(): void {
  if (logStream) return;
  const filePath = getLogFilePath();
  if (!filePath) return;
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    if (fs.existsSync(filePath) && fs.statSync(filePath).size > MAX_LOG_BYTES) {
      try {
        fs.renameSync(filePath, `${filePath}.old`);
      } catch {
        // 轮转失败不阻塞
      }
    }
  } catch {
    // 目录不可用等
  }
  logStream = fs.createWriteStream(filePath, { flags: 'a', encoding: 'utf8' });
  logStream.on('error', () => {
    logStream = null;
  });
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function timestamp(): string {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, '0')}`;
}

function truncateString(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…(+${value.length - max}字符)`;
}

function summarizeArg(value: unknown): unknown {
  if (typeof value === 'string') return truncateString(value, 300);
  if (value instanceof Error) return truncateString(value.message, 300);
  if (typeof value === 'object' && value !== null) {
    try {
      const json = JSON.stringify(value, (_key, v) => {
        if (typeof v === 'string') return truncateString(v, 160);
        if (v instanceof Error) return truncateString(v.message, 160);
        if (Array.isArray(v) && v.length > 20) return `[Array(${v.length})]`;
        return v;
      });
      return truncateString(json ?? String(value), 400);
    } catch {
      return truncateString(String(value), 300);
    }
  }
  return value;
}

function write(scope: string, level: LogLevel, args: unknown[]): void {
  const msg = args.map((a) => {
    const s = summarizeArg(a);
    return typeof s === 'string' ? s : String(s);
  }).join(' ');
  const line = `[${timestamp()}][${scope}][${level.toUpperCase()}] ${msg}`;

  const enabled = isDebugMode();
  // debug 仅在调试模式可见；info/warn/error 始终走控制台
  const showConsole = level !== 'debug' || enabled;
  if (showConsole) {
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else if (level === 'info') console.info(line);
    else console.debug(line);
  }
  if (!enabled) return;
  openLogStream();
  if (logStream) {
    logStream.write(`${line}\n`);
  }
}

function makeLogger(scope: string): Logger {
  const bound = (level: LogLevel) => (msg: string, ...args: unknown[]) => write(scope, level, [msg, ...args]);
  return {
    debug: bound('debug'),
    info: bound('info'),
    warn: bound('warn'),
    error: bound('error'),
  };
}

export function createLogger(scope: string): Logger {
  return makeLogger(scope);
}

// ---------------- IPC 日志（全局包装 ipcMain.handle） ----------------

function isResultLike(value: unknown): value is { success?: boolean; error?: unknown } {
  return typeof value === 'object' && value !== null && 'success' in value;
}

function summarize(payload: unknown[]): unknown[] {
  return payload.map(summarizeArg);
}

/**
 * 包装所有 ipcMain.handle：每次调用记录 channel、耗时与成败。
 * 必须在业务 handler 注册前调用（main.ts 顶层）。
 */
export function installIpcLogging(): void {
  const rawHandle = ipcMain.handle.bind(ipcMain);
  const log = makeLogger('ipc');
  (ipcMain as unknown as { handle: typeof ipcMain.handle }).handle = (
    channel: string,
    listener: (event: Electron.IpcMainInvokeEvent, ...args: unknown[]) => unknown,
  ) => {
    const wrapped = async (event: Electron.IpcMainInvokeEvent, ...args: unknown[]): Promise<unknown> => {
      log.debug(`→ ${channel}`, summarize(args));
      const started = Date.now();
      try {
        const result = await listener(event, ...args);
        const ms = Date.now() - started;
        const failed = isResultLike(result) && result.success === false;
        if (failed) {
          log.error(`✗ ${channel} (${ms}ms)`, isResultLike(result) ? (result.error ?? 'unknown error') : 'failed');
        } else {
          log.debug(`← ${channel} ok (${ms}ms)`, summarize([result]));
        }
        return result;
      } catch (err) {
        const ms = Date.now() - started;
        log.error(`! ${channel} 异常 (${ms}ms)`, err);
        throw err;
      }
    };
    return rawHandle(channel, wrapped as never);
  };
}

/** 渲染进程日志桥：ipcRenderer.send('log:write', { level, scope, message }) 汇入统一日志 */
export function registerRendererLogBridge(): void {
  ipcMain.on('log:write', (_event, payload: unknown) => {
    try {
      const p = payload as { level?: string; scope?: string; message?: string } | null;
      if (!p || typeof p.message !== 'string') return;
      const level = (p.level === 'debug' || p.level === 'info' || p.level === 'warn' || p.level === 'error') ? p.level : 'info';
      const scope = typeof p.scope === 'string' && p.scope ? p.scope : 'renderer';
      write(`renderer/${scope}`, level, [p.message]);
    } catch {
      // 日志桥异常不抛给渲染进程
    }
  });
  ipcMain.handle('log:getInfo', () => ({
    filePath: isDebugMode() ? getLogFilePath() : null,
    debugMode: isDebugMode(),
  }));
}
