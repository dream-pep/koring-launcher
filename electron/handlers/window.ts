import electron from 'electron';
import path from 'path';

const { ipcMain, dialog, shell } = electron;

const isDev = !electron.app.isPackaged;

interface WinRef {
  mainWindow: electron.BrowserWindow | null;
  splashWindow: electron.BrowserWindow | null;
}

const MIME_MAP: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
};

function createSplashWindow(): electron.BrowserWindow {
  const splash = new electron.BrowserWindow({
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
  } else {
    splash.loadFile(path.join(__dirname, '../dist/splash.html'));
  }

  return splash;
}

export function registerWindowHandlers(win: WinRef) {
  ipcMain.handle('window:minimize', () => {
    win.mainWindow?.minimize();
  });

  ipcMain.handle('window:maximize', () => {
    if (win.mainWindow?.isMaximized()) {
      win.mainWindow.unmaximize();
    } else {
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
    return (win.mainWindow as any)?.themeSource ?? null;
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
  ipcMain.handle('dialog:openFile', async (_event, payload: {
    filters?: { name: string; extensions: string[] }[];
  }) => {
    const result = await dialog.showOpenDialog(win.mainWindow!, {
      properties: ['openFile'],
      filters: payload.filters,
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const srcPath = result.filePaths[0];
    const ext = path.extname(srcPath).toLowerCase() || '.png';
    return { srcPath, ext };
  });

  // Open external URL in system browser
  ipcMain.handle('shell:openExternal', async (_event, url: string) => {
    await shell.openExternal(url);
  });

  // Folder dialog — select a directory
  ipcMain.handle('dialog:openFolder', async () => {
    const result = await dialog.showOpenDialog(win.mainWindow!, {
      properties: ['openDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return { folderPath: result.filePaths[0] };
  });
}
