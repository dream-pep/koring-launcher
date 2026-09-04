/**
 * 渲染端统一日志。
 *
 * 规则（与主进程 electron/core/logger.ts 对齐）：
 * - 默认（非 debug）：error/warn/info 输出到控制台（DevTools），debug 不输出；
 * - 用户开启「调试模式」（config.advanced.debugMode）后：debug 也输出，
 *   并经由 electronAPI.log → 主进程 log:write 桥汇入主进程统一日志：
 *   dev（未打包）运行下同步输出到启动终端的 stdout/stderr，同时写入 userData/koring.log。
 */

import { useConfigStore } from "@/stores/configStore";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface RendererLogger {
  debug: (msg: string, ...args: unknown[]) => void;
  info: (msg: string, ...args: unknown[]) => void;
  warn: (msg: string, ...args: unknown[]) => void;
  error: (msg: string, ...args: unknown[]) => void;
}

function serialize(value: unknown): string {
  if (typeof value === "string") {
    return value.length > 800 ? `${value.slice(0, 800)}…(+${value.length - 800})` : value;
  }
  if (value instanceof Error) return value.message;
  if (typeof value === "object" && value !== null) {
    try {
      return JSON.stringify(value) ?? String(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function isDebugMode(): boolean {
  try {
    return useConfigStore.getState().config?.advanced?.debugMode === true;
  } catch {
    return false;
  }
}

function emit(scope: string, level: LogLevel, msg: string, args: unknown[]): void {
  const text = args.length ? `${msg} ${args.map(serialize).join(" ")}` : msg;
  const line = `[${scope}][${level.toUpperCase()}] ${text}`;
  const debugOn = isDebugMode();

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else if (level === "info") console.info(line);
  else if (debugOn) console.debug(line);

  if (!debugOn) return;
  window.electronAPI?.log?.(level, scope, line);
}

function make(scope: string): RendererLogger {
  const bound = (level: LogLevel) => (msg: string, ...args: unknown[]) => emit(scope, level, msg, args);
  return {
    debug: bound("debug"),
    info: bound("info"),
    warn: bound("warn"),
    error: bound("error"),
  };
}

export function createRendererLogger(scope: string): RendererLogger {
  return make(scope);
}
