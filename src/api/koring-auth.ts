import { ipcInvoke } from './ipc';

export interface DeviceAuthResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  expires_in: number;
}

export interface KoringUser {
  sub: string;
  name: string;
  username: string;
  email: string;
  picture: string;
}

export interface KoringAuthData {
  user: KoringUser;
  access_token: string;
  refresh_token: string;
  id_token: string;
  expires_at: number;
}

export async function requestDeviceCode(): Promise<DeviceAuthResponse> {
  return ipcInvoke<DeviceAuthResponse>('koring-auth:request-device-code');
}

export async function pollForToken(
  device_code: string
): Promise<{ user: KoringUser }> {
  return ipcInvoke<{ user: KoringUser }>('koring-auth:poll-token', device_code);
}

export async function refreshKoringToken(): Promise<{ user: KoringUser }> {
  return ipcInvoke<{ user: KoringUser }>('koring-auth:refresh');
}

export async function getKoringUser(): Promise<KoringAuthData | null> {
  return ipcInvoke<KoringAuthData | null>('koring-auth:get-user');
}

export async function logoutKoring(): Promise<void> {
  return ipcInvoke<void>('koring-auth:logout');
}
