"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerWindowHandlers = registerWindowHandlers;
const electron_1 = __importDefault(require("electron"));
const path_1 = __importDefault(require("path"));
const { ipcMain, dialog, shell } = electron_1.default;
const isDev = !electron_1.default.app.isPackaged;
const MIME_MAP = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    bmp: 'image/bmp',
    svg: 'image/svg+xml',
};
function createSplashWindow() {
    const splash = new electron_1.default.BrowserWindow({
        width: 480,
        height: 320,
        transparent: true,
        frame: false,
        resizable: false,
        skipTaskbar: true,
        alwaysOnTop: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
        },
    });
    if (isDev) {
        splash.loadURL('http://localhost:1420/splash.html');
    }
    else {
        splash.loadFile(path_1.default.join(__dirname, '../dist/splash.html'));
    }
    return splash;
}
function registerWindowHandlers(win) {
    ipcMain.handle('window:minimize', () => {
        win.mainWindow?.minimize();
    });
    ipcMain.handle('window:maximize', () => {
        if (win.mainWindow?.isMaximized()) {
            win.mainWindow.unmaximize();
        }
        else {
            win.mainWindow?.maximize();
        }
    });
    ipcMain.handle('window:close', () => {
        win.mainWindow?.close();
    });
    ipcMain.handle('window:isMaximized', () => {
        return win.mainWindow?.isMaximized() ?? false;
    });
    ipcMain.handle('window:getTheme', () => {
        return win.mainWindow?.themeSource ?? null;
    });
    // Splash window management
    ipcMain.handle('window:openSplash', () => {
        if (win.splashWindow && !win.splashWindow.isDestroyed()) {
            win.splashWindow.focus();
            return { success: true };
        }
        win.splashWindow = createSplashWindow();
        return { success: true };
    });
    ipcMain.handle('window:closeSplash', () => {
        if (win.splashWindow && !win.splashWindow.isDestroyed()) {
            win.splashWindow.close();
            win.splashWindow = null;
        }
        return { success: true };
    });
    // File dialog — returns source path and extension for preload to handle
    ipcMain.handle('dialog:openFile', async (_event, payload) => {
        const result = await dialog.showOpenDialog(win.mainWindow, {
            properties: ['openFile'],
            filters: payload.filters,
        });
        if (result.canceled || result.filePaths.length === 0)
            return null;
        const srcPath = result.filePaths[0];
        const ext = path_1.default.extname(srcPath).toLowerCase() || '.png';
        return { srcPath, ext };
    });
    // Open external URL in system browser
    ipcMain.handle('shell:openExternal', async (_event, url) => {
        await shell.openExternal(url);
    });
}
