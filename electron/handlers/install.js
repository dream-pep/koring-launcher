"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerInstallHandlers = registerInstallHandlers;
const electron_1 = __importDefault(require("electron"));
const installer_1 = require("../core/installer");
const { ipcMain } = electron_1.default;
function registerInstallHandlers(win) {
    ipcMain.handle('install:version-list', async (_event, payload) => {
        try {
            const data = await (0, installer_1.getVersionList)(payload.type);
            return { success: true, data, error: null };
        }
        catch (e) {
            return { success: false, data: null, error: String(e) };
        }
    });
    ipcMain.handle('install:forge-version-list', async (_event, payload) => {
        try {
            const data = await (0, installer_1.getForgeVersions)(payload.mcVersion);
            return { success: true, data, error: null };
        }
        catch (e) {
            return { success: false, data: null, error: String(e) };
        }
    });
    ipcMain.handle('install:fabric-version-list', async (_event, payload) => {
        try {
            const data = await (0, installer_1.getFabricVersions)(payload.mcVersion);
            return { success: true, data, error: null };
        }
        catch (e) {
            return { success: false, data: null, error: String(e) };
        }
    });
    ipcMain.handle('install:minecraft', async (_event, payload) => {
        try {
            const requestId = `install-mc-${Date.now()}`;
            (0, installer_1.installMinecraft)(payload.version, payload.gamePath, payload.javaPath, payload.downloadThreads, {
                onProgress: (progress) => {
                    win.mainWindow?.webContents.send('install:progress', { requestId, ...progress });
                },
            }).then((result) => {
                win.mainWindow?.webContents.send('install:complete', { requestId, ...result });
            }).catch((err) => {
                win.mainWindow?.webContents.send('install:error', { requestId, error: String(err) });
            });
            return { success: true, data: { requestId }, error: null };
        }
        catch (e) {
            return { success: false, data: null, error: String(e) };
        }
    });
    ipcMain.handle('install:mod-loader', async (_event, payload) => {
        try {
            const requestId = `install-loader-${Date.now()}`;
            (0, installer_1.installModLoader)(payload.mcVersion, payload.gamePath, payload.loaderType, payload.loaderVersion, payload.javaPath, {
                onProgress: (progress) => {
                    win.mainWindow?.webContents.send('install:progress', { requestId, ...progress });
                },
            }).then((result) => {
                win.mainWindow?.webContents.send('install:complete', { requestId, ...result });
            }).catch((err) => {
                win.mainWindow?.webContents.send('install:error', { requestId, error: String(err) });
            });
            return { success: true, data: { requestId }, error: null };
        }
        catch (e) {
            return { success: false, data: null, error: String(e) };
        }
    });
}
