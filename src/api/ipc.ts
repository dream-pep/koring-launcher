export interface SidecarResponse<T = unknown> {
  id: string;
  type: 'result' | 'error' | 'progress' | 'event';
  payload: T;
}

export interface CommandResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface ResultPayload<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ProgressPayload {
  stage: string;
  current: number;
  total: number;
  message?: string;
}

export async function ipcInvoke<T = unknown>(channel: string, payload?: unknown): Promise<T> {
  const result = await window.electronAPI?.invoke(channel, payload) as CommandResult;
  if (!result?.success) {
    throw new Error(result?.error || 'Request failed');
  }
  return result.data as T;
}

export function onIpcEvent<T = unknown>(channel: string, callback: (data: T) => void): () => void {
  return window.electronAPI?.on(channel, (data) => callback(data as T)) ?? (() => {});
}
