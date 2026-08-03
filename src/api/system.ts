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

// 在系统文件管理器中打开指定路径（用于"打开游戏目录"等操作）
export async function openPath(targetPath: string): Promise<{ success: boolean; error?: string }> {
  return ipcInvoke<{ success: boolean; error?: string }>('system:open-path', { path: targetPath });
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
