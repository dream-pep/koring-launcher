import { ipcInvoke, onIpcEvent } from './ipc';

/** 启动所需的账户档案（来自 authStore） */
export interface LaunchProfile {
  username: string;
  uuid: string;
  accessToken?: string;
}

/** 快速联机目标服务器 */
export interface LaunchServer {
  ip: string;
  port?: number;
}

/** 统一启动接口契约：指定实例 + 游戏根目录 + 账户档案（可选快速联机） */
export interface LaunchGamePayload {
  instanceName: string;
  /** 实例父目录（游戏根目录） */
  gamePath: string;
  profile: LaunchProfile;
  server?: LaunchServer;
}

export interface LaunchResult {
  pid: number;
  version: string;
  username: string;
  requestId: string;
}

/**
 * 启动游戏。主进程会读取权威配置（Koring.yml 内存缓存）自动应用
 * Java 路径 / 内存 / GC / JVM 参数 / 游戏参数 / 窗口模式 / 启动前命令等设置。
 */
export async function launchGame(payload: LaunchGamePayload): Promise<LaunchResult> {
  return ipcInvoke<LaunchResult>('launch:launch', payload);
}

export async function diagnoseVersion(
  gamePath: string,
  version: string
) {
  return ipcInvoke('launch:diagnose', { gamePath, version });
}

/** 订阅某个启动请求的游戏事件流（stdout / stderr / window-ready / exit） */
export function onGameEvent(
  requestId: string,
  callback: (event: { event: string; [key: string]: unknown }) => void
): () => void {
  return onIpcEvent<{ requestId: string; event: string; [key: string]: unknown }>(
    'launch:event',
    (data) => {
      if (data.requestId === requestId) {
        callback(data);
      }
    }
  );
}

export interface WaitForGameReadyOptions {
  /** 超时时间（毫秒），默认 120 秒 */
  timeoutMs?: number;
  /** 主进程启动阶段的告警（缺文件 / 加载器回退等） */
  onWarning?: (message: string) => void;
  /** 其他事件（stdout / stderr / plan 等），供日志使用 */
  onEvent?: (event: { event: string; [key: string]: unknown }) => void;
}

/**
 * 等待游戏窗口就绪（window-ready）——「启动完成」的判定点。
 * 若游戏进程在窗口就绪前退出，或超过超时时间，则 reject。
 */
export function waitForGameReady(
  requestId: string,
  options: WaitForGameReadyOptions = {}
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? 120_000;
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let unlisten: (() => void) | null = null;

    const finish = (done: () => void) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      unlisten?.();
      done();
    };

    timer = setTimeout(() => {
      finish(() => reject(new Error(`等待游戏窗口就绪超时（${Math.round(timeoutMs / 1000)} 秒）`)));
    }, timeoutMs);

    unlisten = onGameEvent(requestId, (event) => {
      options.onEvent?.(event);
      if (event.event === 'warning') {
        const message = typeof event.message === 'string' ? event.message : '启动阶段出现告警';
        options.onWarning?.(message);
        return;
      }
      if (event.event === 'window-ready') {
        finish(resolve);
        return;
      }
      if (event.event === 'exit') {
        const code = typeof event.code === 'number' ? event.code : undefined;
        finish(() =>
          reject(
            new Error(
              code === undefined
                ? '游戏在窗口就绪前退出'
                : `游戏在窗口就绪前退出（退出码 ${code}）`
            )
          )
        );
      }
    });
  });
}
