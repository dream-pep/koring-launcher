import electron from 'electron';
import path from 'path';
import fs from 'fs';
import { writeCrashLog, readCrashLog, clearCrashLog, type CrashEntry } from '../core/crash-logger';
import { configPath } from '../config';
import { authPath } from '../auth';
import { createLogger } from '../core/logger';

const { app, ipcMain, BrowserWindow } = electron;

const log = createLogger('crash-monitor');

const isDev = !app.isPackaged;

let crashWin: electron.BrowserWindow | null = null;

function getIconPath(): string {
  return path.join(__dirname, '../../build/icon.ico');
}

function createCrashWindow(): electron.BrowserWindow {
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
      preload: path.join(__dirname, '../preload-crash.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  if (isDev) {
    win.loadURL('http://localhost:1420/crash.html');
  } else {
    win.loadFile(path.join(__dirname, '../../dist/crash.html'));
  }

  return win;
}

function sendToCrashWindow(data: CrashEntry) {
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
  } else {
    send();
  }
}

export function setupCrashListeners(mainWindow: electron.BrowserWindow) {
  mainWindow.webContents.on('render-process-gone', (_event: any, details: any) => {
    const entry: CrashEntry = {
      timestamp: new Date().toISOString(),
      type: 'renderer-gone',
      message: `渲染进程崩溃: ${details.reason} (退出码: ${details.exitCode})`,
      details: details as unknown as Record<string, unknown>,
    };
    writeCrashLog(entry);
    sendToCrashWindow(entry);
  });

  mainWindow.on('unresponsive', () => {
    const entry: CrashEntry = {
      timestamp: new Date().toISOString(),
      type: 'unresponsive',
      message: '渲染进程无响应',
    };
    writeCrashLog(entry);
    sendToCrashWindow(entry);
  });

  // Inject devtools crash tools when devtools opens
  if (isDev) {
    mainWindow.webContents.on('devtools-opened', () => {
      const js = `
        (function() {
          if (window.__crashToolsLoaded) return;
          window.__crashToolsLoaded = true;

          log.info('%c[崩溃工具] 已加载', 'color: #f59e0b; font-weight: bold; font-size: 14px;');
          log.info('%c可用命令:', 'color: #3b82f6; font-weight: bold;');
          log.info('%c  crash.simulate()    %c— 模拟渲染进程崩溃', 'color: #ef4444; font-weight: bold;', 'color: inherit;');
          log.info('%c  crash.testDialog()  %c— 测试崩溃弹窗', 'color: #ef4444; font-weight: bold;', 'color: inherit;');
          log.info('%c  crash.readLog()     %c— 读取崩溃日志', 'color: #ef4444; font-weight: bold;', 'color: inherit;');
          log.info('%c  crash.factoryReset()%c— 强还原配置', 'color: #ef4444; font-weight: bold;', 'color: inherit;');
          log.info('%c  crash.restart()     %c— 重启应用', 'color: #ef4444; font-weight: bold;', 'color: inherit;');
          log.info('');

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

export function registerCrashHandlers() {
  // Close crash window
  ipcMain.handle('crash:closeWindow', () => {
    if (crashWin && !crashWin.isDestroyed()) {
      crashWin.close();
      crashWin = null;
    }
  });

  // Read crash log
  ipcMain.handle('crash:readLog', () => {
    return readCrashLog();
  });

  // Simulate crash — forcefully crash the renderer (devtools only)
  ipcMain.handle('crash:simulate', (_event) => {
    const senderWebContents = electron.webContents.getAllWebContents().find(
      (wc) => wc.id === _event.sender.id
    );
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
    // Delete config（userData / 项目根目录，与 configPath 一致）
    try {
      const config = configPath();
      if (fs.existsSync(config)) fs.unlinkSync(config);
    } catch {}

    // Delete auth（userData / 项目根目录，与 authPath 一致）
    try {
      const auth = authPath();
      if (fs.existsSync(auth)) fs.unlinkSync(auth);
    } catch {}

    // Delete background cache in userData
    try {
      const bgPath = path.join(app.getPath('userData'), 'background.png');
      if (fs.existsSync(bgPath)) fs.unlinkSync(bgPath);
    } catch {}

    // Delete crash log
    clearCrashLog();

    return { success: true };
  });

  // Restart app
  ipcMain.handle('crash:restart', () => {
    app.relaunch();
    app.exit(0);
  });

  // Main process error handlers
  process.on('uncaughtException', (error) => {
    const entry: CrashEntry = {
      timestamp: new Date().toISOString(),
      type: 'uncaught-exception',
      message: error.message,
      stack: error.stack,
    };
    writeCrashLog(entry);
    sendToCrashWindow(entry);
  });

  process.on('unhandledRejection', (reason) => {
    const entry: CrashEntry = {
      timestamp: new Date().toISOString(),
      type: 'unhandled-rejection',
      message: String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    };
    writeCrashLog(entry);
    sendToCrashWindow(entry);
  });
}

// Called from devtools to test crash dialog
export function testCrashDialog() {
  const entry: CrashEntry = {
    timestamp: new Date().toISOString(),
    type: 'test',
    message: '这是一个测试崩溃弹窗',
  };
  sendToCrashWindow(entry);
}
