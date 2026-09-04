import electron from 'electron';
import { execSync } from 'child_process';
import * as os from 'os';

const { ipcMain, app, shell } = electron;

interface ProcessMemorySample {
  type: string;
  pid: number;
  workingSetSize: number; // KB
  peakWorkingSetSize: number; // KB
}

function getBiosId(): string {
  if (process.platform !== 'win32') return 'N/A (non-Windows)';
  try {
    const output = execSync('powershell -NoProfile -Command "(Get-CimInstance Win32_BIOS).SerialNumber"', {
      encoding: 'utf-8',
      timeout: 5000,
    });
    return output.trim() || 'Unknown';
  } catch {
    return 'Unknown';
  }
}

function getOsVersion(): string {
  if (process.platform !== 'win32') return 'N/A (non-Windows)';
  try {
    const output = execSync('powershell -NoProfile -Command "[System.Environment]::OSVersion.VersionString"', {
      encoding: 'utf-8',
      timeout: 5000,
    });
    return output.trim() || 'Unknown';
  } catch {
    return 'Unknown';
  }
}

function getOsName(): string {
  if (process.platform !== 'win32') return 'N/A (non-Windows)';
  try {
    const output = execSync('powershell -NoProfile -Command "(Get-CimInstance Win32_OperatingSystem).Caption"', {
      encoding: 'utf-8',
      timeout: 5000,
    });
    return output.trim() || 'Unknown';
  } catch {
    return 'Unknown';
  }
}

export function registerSystemHandlers() {
  ipcMain.handle('system:info', () => {
    try {
      return {
        success: true,
        data: {
          app_version: app.getVersion(),
          bios_id: getBiosId(),
          os_version: getOsVersion(),
          os_name: getOsName(),
        },
        error: null,
      };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });

  // 进程内存快照（资源/内存调试面板使用；纯读取，无副作用）
  ipcMain.handle('system:memory', async () => {
    try {
      const metrics: ProcessMemorySample[] = app.getAppMetrics().map((m) => ({
        type: String(m.type),
        pid: m.pid,
        workingSetSize: m.memory?.workingSetSize ?? 0,
        peakWorkingSetSize: m.memory?.peakWorkingSetSize ?? 0,
      }));
      let mainProcess: { workingSetSize: number; privateBytes: number } | null = null;
      try {
        const info = await process.getProcessMemoryInfo();
        mainProcess = {
          workingSetSize: info.workingSetSize,
          privateBytes: info.privateBytes,
        };
      } catch {
        // 个别平台不支持 getProcessMemoryInfo，忽略
      }
      return {
        success: true,
        data: {
          app_version: app.getVersion(),
          timestamp: Date.now(),
          metrics,
          mainProcess,
        },
        error: null,
      };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });

  // 在系统文件管理器中打开指定路径（用于"打开游戏目录"等操作）
  ipcMain.handle('system:open-path', async (_event, payload: { path: string }) => {
    try {
      const error = await shell.openPath(payload.path);
      return { success: !error, data: { error }, error: error || null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });
}
