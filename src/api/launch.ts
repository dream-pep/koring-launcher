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
