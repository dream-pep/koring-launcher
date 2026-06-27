import { ipcInvoke, onIpcEvent } from './ipc';

export interface LaunchOptions {
  gamePath: string;
  javaPath: string;
  version: string;
  username: string;
  uuid: string;
  accessToken?: string;
  memory?: { min?: string; max?: string };
  jvmArgs?: string[];
  gameArgs?: string[];
  server?: { ip: string; port?: number };
  detached?: boolean;
}

export interface LaunchResult {
  pid: number;
  version: string;
  username: string;
  requestId: string;
}

export async function launchGame(options: LaunchOptions): Promise<LaunchResult> {
  return ipcInvoke<LaunchResult>('launch:launch', options);
}

export async function diagnoseVersion(
  gamePath: string,
  version: string
) {
  return ipcInvoke('launch:diagnose', { gamePath, version });
}

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
