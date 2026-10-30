import electron from 'electron';
import { execSync } from 'child_process';
import * as os from 'os';
import { getDeviceId, getOsInfo, getSmbiosUuid } from '../core/device-id';

const { ipcMain, app, shell } = electron;

interface ProcessMemorySample {
  type: string;
  pid: number;
  workingSetSize: number; // KB
  peakWorkingSetSize: number; // KB
}

/**
 * 设备序列号（system:info 的 bios_id 字段，用于「关于」页展示）。
 * - Windows：BIOS 序列号（Win32_BIOS.SerialNumber）
 * - macOS：因隐私限制禁止读取硬件标识，返回 OpenUDID（应用自生成并持久化的 UUID）
 */
function getBiosId(): string {
  if (process.platform === 'darwin') {
    return getSmbiosUuid().uuid || 'Unknown';
  }
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

/**
 * 操作系统版本。
 * - Windows：PowerShell 读取
 * - macOS：sw_vers（复用 device-id 的探测缓存）
 */
function getOsVersion(): string {
  if (process.platform === 'darwin') {
    return getOsInfo().version || os.release();
  }
  if (process.platform !== 'win32') return os.release();
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

/**
 * 操作系统名称。
 * - Windows：PowerShell 读取
 * - macOS：macOS（复用 device-id 的探测缓存，返回 sw_vers 的 productName）
 */
function getOsName(): string {
  if (process.platform === 'darwin') {
    return getOsInfo().name || 'macOS';
  }
  if (process.platform !== 'win32') return os.type();
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

  // 设备唯一标识：
  // - smbiosUuid：原始 SMBIOS UUID（Account API 设备上报/追踪用的 uuid）
  // - deviceId  ：组合指纹哈希（主板/硬盘/BIOS → 回退 MachineGuid），SMBIOS 缺失时的兜底
  // 进程内缓存，首次调用探测一次
  ipcMain.handle('system:deviceId', () => {
    try {
      const identity = getDeviceId();
      const smbios = getSmbiosUuid();
      return {
        success: true,
        data: {
          ...identity,
          smbiosUuid: smbios.uuid || null,
          smbiosSource: smbios.source,
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
          workingSetSize: info.residentSet ?? 0,
          privateBytes: info.private ?? 0,
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
