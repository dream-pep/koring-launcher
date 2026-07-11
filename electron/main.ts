import electron from 'electron';
import path from 'path';
import { registerConfigHandlers } from './handlers/config';
import { registerAuthHandlers } from './handlers/auth';
import { registerInstallHandlers } from './handlers/install';
import { registerLaunchHandlers } from './handlers/launch';
import { registerModsHandlers } from './handlers/mods';
import { registerInstanceHandlers } from './handlers/instance';
import { registerBackgroundHandlers } from './handlers/background';
import { registerTaskHandlers } from './handlers/task';
import { registerSystemHandlers } from './handlers/system';
import { registerWindowHandlers } from './handlers/window';

const { app } = electron;

const isDev = !app.isPackaged;

// Mutable ref — handlers always read from this
const win: { mainWindow: electron.BrowserWindow | null; splashWindow: electron.BrowserWindow | null } = {
  mainWindow: null,
  splashWindow: null,
};

function createSplashWindow(): electron.BrowserWindow {
  const iconPath = isDev
    ? path.join(__dirname, '../build/icon.ico')
    : path.join(__dirname, '../build/icon.ico');

  const splash = new electron.BrowserWindow({
    width: 480,
    height: 320,
    transparent: true,
    frame: false,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    icon: iconPath,
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

function createMainWindow(): electron.BrowserWindow {
  const iconPath = isDev
    ? path.join(__dirname, '../build/icon.ico')
    : path.join(__dirname, '../build/icon.ico');

  const main = new electron.BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    transparent: false,
    resizable: true,
    show: false,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  if (isDev) {
    main.loadURL('http://localhost:1420');
  } else {
    main.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  main.on('maximize', () => {
    main.webContents.send('window:resized');
  });

  main.on('unmaximize', () => {
    main.webContents.send('window:resized');
  });

  return main;
}

function registerAllHandlers() {
  registerConfigHandlers();
  registerAuthHandlers();
  registerInstallHandlers(win);
  registerLaunchHandlers(win);
  registerModsHandlers();
  registerInstanceHandlers(win);
  registerBackgroundHandlers();
  registerTaskHandlers(win);
  registerSystemHandlers();
  registerWindowHandlers(win);
}

app.whenReady().then(() => {
  registerAllHandlers();

  // 1. Show splash immediately
  win.splashWindow = createSplashWindow();

  // 2. Create main window in background
  win.mainWindow = createMainWindow();

  // 3. When main window finishes loading, wait a minimum time then transition
  let mainReady = false;
  let splashMinTimeDone = false;

  const tryTransition = () => {
    if (mainReady && splashMinTimeDone) {
      if (win.mainWindow && !win.mainWindow.isDestroyed()) {
        win.mainWindow.show();
        win.mainWindow.focus();
      }
      if (win.splashWindow && !win.splashWindow.isDestroyed()) {
        win.splashWindow.close();
        win.splashWindow = null;
      }
    }
  };

  win.mainWindow.once('ready-to-show', () => {
    mainReady = true;
    tryTransition();
  });

  // Minimum splash display time (1.5s)
  setTimeout(() => {
    splashMinTimeDone = true;
    tryTransition();
  }, 1500);
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (electron.BrowserWindow.getAllWindows().length === 0) {
    win.mainWindow = createMainWindow();
  }
});
