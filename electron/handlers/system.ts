import electron from 'electron';
import { execSync } from 'child_process';
import * as os from 'os';

const { ipcMain, app } = electron;

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
}
