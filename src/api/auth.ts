import { ipcInvoke } from './ipc';

export interface AuthResult {
  username: string;
  uuid: string;
  accessToken: string;
  expiresAt?: number;
  xboxProfile?: {
    gamertag: string;
    gamerscore: string;
    displayPicRaw: string;
  };
}

export async function offlineLogin(username: string): Promise<AuthResult> {
  return ipcInvoke<AuthResult>('auth:offline-login', { username });
}

export async function microsoftLoginStart(clientId: string, redirectUri?: string) {
  return ipcInvoke<{ state: string; authUrl: string }>(
    'auth:microsoft-login-start',
    { client_id: clientId, redirect_uri: redirectUri }
  );
}

export async function microsoftLoginCallback(
  code: string,
  clientId: string,
  redirectUri?: string
): Promise<AuthResult> {
  return ipcInvoke<AuthResult>('auth:microsoft-login-callback', {
    code,
    client_id: clientId,
    redirect_uri: redirectUri,
  });
}

export async function validateToken(accessToken: string): Promise<boolean> {
  const result = await ipcInvoke<{ valid: boolean }>('auth:validate-token', {
    accessToken,
  });
  return result.valid;
}
