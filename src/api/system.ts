import { ipcInvoke } from './ipc';

export interface SystemInfo {
  app_version: string;
  bios_id: string;
  os_version: string;
  os_name: string;
}

export async function getSystemInfo(): Promise<SystemInfo> {
  return ipcInvoke<SystemInfo>('system:info');
}

export interface LocaleInfo {
  language: string;
  region: string;
  timezone: string;
}

export function getLocaleInfo(): LocaleInfo {
  const language = navigator.language || 'Unknown';
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Unknown';
  const match = language.match(/[-_]([A-Z]{2})$/i);
  const region = match ? match[1].toUpperCase() : 'Unknown';
  return { language, region, timezone };
}
