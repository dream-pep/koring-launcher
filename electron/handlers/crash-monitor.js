"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupCrashListeners = setupCrashListeners;
exports.registerCrashHandlers = registerCrashHandlers;
exports.testCrashDialog = testCrashDialog;
const electron_1 = __importDefault(require("electron"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const crash_logger_1 = require("../core/crash-logger");
const { app, ipcMain, BrowserWindow } = electron_1.default;
const isDev = !app.isPackaged;
let crashWin = null;
function getIconPath() {
    return path_1.default.join(__dirname, '../../build/icon.ico');
}
function createCrashWindow() {
    const iconPath = getIconPath();
    const win = new BrowserWindow({
        width: 600,
        height: 460,
        minWidth: 500,
        maxWidth: 700,
        minHeight: 460,
        maxHeight: 460,
        frame: false,
        transparent: false,
        resizable: false,
        show: false,
        icon: iconPath,
        webPreferences: {
            preload: path_1.default.join(__dirname, '../preload-crash.js'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
        },
    });
    if (isDev) {
        win.loadURL('http://localhost:1420/crash.html');
    }
    else {
        win.loadFile(path_1.default.join(__dirname, '../../dist/crash.html'));
    }
    return win;
}
function sendToCrashWindow(data) {
    if (!crashWin || crashWin.isDestroyed()) {
        crashWin = createCrashWindow();
    }
    const send = () => {
        crashWin?.show();
        crashWin?.focus();
        crashWin?.webContents.send('crash:show', {
            type: data.type,
            message: data.message,
            timestamp: data.timestamp,
        });
    };
    if (crashWin.webContents.isLoading()) {
        crashWin.webContents.once('did-finish-load', send);
    }
    else {
        send();
    }
}
function setupCrashListeners(mainWindow) {
    mainWindow.webContents.on('render-process-gone', (_event, details) => {
        const entry = {
            timestamp: new Date().toISOString(),
            type: 'renderer-gone',
            message: `渲染进程崩溃: ${details.reason} (退出码: ${details.exitCode})`,
            details: details,
        };
        (0, crash_logger_1.writeCrashLog)(entry);
        sendToCrashWindow(entry);
    });
    mainWindow.on('unresponsive', () => {
        const entry = {
            timestamp: new Date().toISOString(),
            type: 'unresponsive',
            message: '渲染进程无响应',
        };
        (0, crash_logger_1.writeCrashLog)(entry);
        sendToCrashWindow(entry);
    });
    // Inject devtools crash tools when devtools opens
    if (isDev) {
        mainWindow.webContents.on('devtools-opened', () => {
            const js = `
        (function() {
          if (window.__crashToolsLoaded) return;
          window.__crashToolsLoaded = true;

          console.log('%c[崩溃工具] 已加载', 'color: #f59e0b; font-weight: bold; font-size: 14px;');
          console.log('%c可用命令:', 'color: #3b82f6; font-weight: bold;');
          console.log('%c  crash.simulate()    %c— 模拟渲染进程崩溃', 'color: #ef4444; font-weight: bold;', 'color: inherit;');
          console.log('%c  crash.testDialog()  %c— 测试崩溃弹窗', 'color: #ef4444; font-weight: bold;', 'color: inherit;');
          console.log('%c  crash.readLog()     %c— 读取崩溃日志', 'color: #ef4444; font-weight: bold;', 'color: inherit;');
          console.log('%c  crash.factoryReset()%c— 强还原配置', 'color: #ef4444; font-weight: bold;', 'color: inherit;');
          console.log('%c  crash.restart()     %c— 重启应用', 'color: #ef4444; font-weight: bold;', 'color: inherit;');
          console.log('');

          window.crash = {
            simulate: function() { window.electronAPI?.simulateCrash(); },
            testDialog: function() { window.electronAPI?.testCrashDialog(); },
            readLog: function() { return window.electronAPI?.invoke('crash:readLog'); },
            factoryReset: function() { return window.electronAPI?.invoke('crash:factoryReset'); },
            restart: function() { return window.electronAPI?.invoke('crash:restart'); },
          };
        })();
      `;
            mainWindow.webContents.executeJavaScript(js);
        });
    }
}
function registerCrashHandlers() {
    // Close crash window
    ipcMain.handle('crash:closeWindow', () => {
        if (crashWin && !crashWin.isDestroyed()) {
            crashWin.close();
            crashWin = null;
        }
    });
    // Read crash log
    ipcMain.handle('crash:readLog', () => {
        return (0, crash_logger_1.readCrashLog)();
    });
    // Simulate crash — forcefully crash the renderer (devtools only)
    ipcMain.handle('crash:simulate', (_event) => {
        const senderWebContents = electron_1.default.webContents.getAllWebContents().find((wc) => wc.id === _event.sender.id);
        if (senderWebContents) {
            senderWebContents.forcefullyCrashRenderer();
        }
    });
    // Test crash dialog — show crash window without actually crashing
    ipcMain.handle('crash:testDialog', () => {
        testCrashDialog();
    });
    // Factory reset
    ipcMain.handle('crash:factoryReset', () => {
        const dataPath = app.isPackaged
            ? path_1.default.dirname(app.getPath('exe'))
            : path_1.default.join(__dirname, '../..');
        // Delete config
        try {
            const configPath = path_1.default.join(dataPath, 'Koring.yml');
            if (fs_1.default.existsSync(configPath))
                fs_1.default.unlinkSync(configPath);
        }
        catch { }
        // Delete auth
        try {
            const authPath = path_1.default.join(dataPath, 'koring-auth.json');
            if (fs_1.default.existsSync(authPath))
                fs_1.default.unlinkSync(authPath);
        }
        catch { }
        // Delete background cache in userData
        try {
            const bgPath = path_1.default.join(app.getPath('userData'), 'background.png');
            if (fs_1.default.existsSync(bgPath))
                fs_1.default.unlinkSync(bgPath);
        }
        catch { }
        // Delete crash log
        (0, crash_logger_1.clearCrashLog)();
        return { success: true };
    });
    // Restart app
    ipcMain.handle('crash:restart', () => {
        app.relaunch();
        app.exit(0);
    });
    // Main process error handlers
    process.on('uncaughtException', (error) => {
        const entry = {
            timestamp: new Date().toISOString(),
            type: 'uncaught-exception',
            message: error.message,
            stack: error.stack,
        };
        (0, crash_logger_1.writeCrashLog)(entry);
        sendToCrashWindow(entry);
    });
    process.on('unhandledRejection', (reason) => {
        const entry = {
            timestamp: new Date().toISOString(),
            type: 'unhandled-rejection',
            message: String(reason),
            stack: reason instanceof Error ? reason.stack : undefined,
        };
        (0, crash_logger_1.writeCrashLog)(entry);
        sendToCrashWindow(entry);
    });
}
// Called from devtools to test crash dialog
function testCrashDialog() {
    const entry = {
        timestamp: new Date().toISOString(),
        type: 'test',
        message: '这是一个测试崩溃弹窗',
    };
    sendToCrashWindow(entry);
}
