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

// ---- 进程内存快照（资源/内存调试面板用）----

/** app.getAppMetrics() 的进程项；workingSetSize 单位为 KB */
export interface ProcessMemoryMetric {
  type: string;
  pid: number;
  workingSetSize: number; // KB
  peakWorkingSetSize: number; // KB
}

/** process.getProcessMemoryInfo()（主进程）；单位为字节 */
export interface MainProcessMemory {
  workingSetSize: number; // bytes
  privateBytes: number; // bytes
}

export interface SystemMemorySnapshot {
  app_version: string;
  timestamp: number;
  metrics: ProcessMemoryMetric[];
  mainProcess: MainProcessMemory | null;
}

export async function getMemorySnapshot(): Promise<SystemMemorySnapshot> {
  return ipcInvoke<SystemMemorySnapshot>('system:memory');
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
