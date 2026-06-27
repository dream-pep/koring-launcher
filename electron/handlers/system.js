"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerSystemHandlers = registerSystemHandlers;
const electron_1 = __importDefault(require("electron"));
const child_process_1 = require("child_process");
const { ipcMain, app } = electron_1.default;
function getBiosId() {
    if (process.platform !== 'win32')
        return 'N/A (non-Windows)';
    try {
        const output = (0, child_process_1.execSync)('powershell -NoProfile -Command "(Get-CimInstance Win32_BIOS).SerialNumber"', {
            encoding: 'utf-8',
            timeout: 5000,
        });
        return output.trim() || 'Unknown';
    }
    catch {
        return 'Unknown';
    }
}
function getOsVersion() {
    if (process.platform !== 'win32')
        return 'N/A (non-Windows)';
    try {
        const output = (0, child_process_1.execSync)('powershell -NoProfile -Command "[System.Environment]::OSVersion.VersionString"', {
            encoding: 'utf-8',
            timeout: 5000,
        });
        return output.trim() || 'Unknown';
    }
    catch {
        return 'Unknown';
    }
}
function getOsName() {
    if (process.platform !== 'win32')
        return 'N/A (non-Windows)';
    try {
        const output = (0, child_process_1.execSync)('powershell -NoProfile -Command "(Get-CimInstance Win32_OperatingSystem).Caption"', {
            encoding: 'utf-8',
            timeout: 5000,
        });
        return output.trim() || 'Unknown';
    }
    catch {
        return 'Unknown';
    }
}
function registerSystemHandlers() {
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
        }
        catch (e) {
            return { success: false, data: null, error: String(e) };
        }
    });
}
