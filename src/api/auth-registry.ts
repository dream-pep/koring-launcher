import { ipcInvoke } from './ipc';

export interface AuthData {
  username: string;
  uuid: string;
  accessToken: string;
  refreshToken: string;
  xboxProfile: string;
}

export async function getAuth(): Promise<AuthData> {
  return ipcInvoke<AuthData>('auth:get');
}

export async function saveAuth(auth: AuthData): Promise<void> {
  await ipcInvoke('auth:save', auth);
}

export async function deleteAuth(): Promise<void> {
  await ipcInvoke('auth:delete');
}
