import electron from 'electron';
import path from 'path';
import fs from 'fs';
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
import { registerCrashHandlers, setupCrashListeners, testCrashDialog } from './handlers/crash-monitor';
import { registerKoringAuthHandlers } from './handlers/koring-auth';
import { registerJavaHandlers } from './handlers/java';
import { saveConfig, configExists, getConfig, flushConfig, configPath } from './config';
import { authPath } from './auth';

const { app } = electron;

const isDev = !app.isPackaged;

// GPU acceleration flags
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');

const win: { mainWindow: electron.BrowserWindow | null; splashWindow: electron.BrowserWindow | null } = {
  mainWindow: null,
  splashWindow: null,
};

// 迁移旧版「可执行文件旁」存储 → userData（仅打包模式）。
// 复制而非移动，避免破坏用户已有文件；userData 已有目标文件则跳过。
function migrateLegacyFiles(): void {
  if (!app.isPackaged) return;
  const exeDir = path.dirname(app.getPath('exe'));
  const pairs: { name: string; dest: string }[] = [
    { name: 'Koring.yml', dest: configPath() },
    { name: 'koring-auth.json', dest: authPath() },
  ];
  for (const { name, dest } of pairs) {
    if (fs.existsSync(dest)) continue;
    const src = path.join(exeDir, name);
    if (!fs.existsSync(src)) continue;
    try {
      fs.copyFileSync(src, dest);
      console.log(`[migrate] copied ${name} → ${dest}`);
    } catch (e) {
      console.error(`[migrate] failed to copy ${name}:`, e);
    }
  }
}

// Startup checks: .minecraft dir + config file + first launch detection
function runStartupChecks(): { isFirstLaunch: boolean; config: ReturnType<typeof getConfig> } {
  const dataPath = app.isPackaged
    ? path.dirname(app.getPath('exe'))
    : path.join(__dirname, '..');

  // 1. Ensure .minecraft directory exists
  const minecraftDir = path.join(dataPath, '.minecraft');
  if (!fs.existsSync(minecraftDir)) {
    fs.mkdirSync(minecraftDir, { recursive: true });
  }

  // 2. Check if config exists, if not create with defaults
  const hasConfig = configExists();
  const isFirstLaunch = !hasConfig;

  // 3. Load (or create) config（getConfig 会缓存到主进程内存，成为唯一权威）
  const config = getConfig();
  if (isFirstLaunch) {
    saveConfig(config);
  }

  return { isFirstLaunch, config };
}

// 根据调试/运行状态自动选择窗口图标：
// - 开发调试（未打包）：直接使用 public/icons/dev/ 下的 dev 图标
// - 打包运行：electron-builder 构建时 switch-icon 已把对应模式图标复制到 build/
function getWindowIconPath(): string | undefined {
  if (!app.isPackaged) {
    return path.join(__dirname, '../public/icons/dev/icon.ico');
  }
  const packagedIcon = path.join(__dirname, '../build/icon.ico');
  return fs.existsSync(packagedIcon) ? packagedIcon : undefined;
}

function createSplashWindow(): electron.BrowserWindow {
  const iconPath = getWindowIconPath();

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
  const iconPath = getWindowIconPath();

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
  registerConfigHandlers(win);
  registerAuthHandlers();
  registerInstallHandlers(win);
  registerLaunchHandlers(win);
  registerModsHandlers();
  registerInstanceHandlers(win);
  registerBackgroundHandlers();
  registerTaskHandlers(win);
  registerSystemHandlers();
  registerWindowHandlers(win);
  registerCrashHandlers();
  registerKoringAuthHandlers();
  registerJavaHandlers();
}

app.whenReady().then(() => {
  registerAllHandlers();

  // Migrate legacy exe-dir config/auth to userData before anything reads them
  migrateLegacyFiles();

  // Run startup checks before creating windows
  const { isFirstLaunch, config } = runStartupChecks();

  // 1. Show splash immediately
  win.splashWindow = createSplashWindow();

  // 2. Create main window in background
  win.mainWindow = createMainWindow();

  // 3. Preload config into renderer before it renders
  win.mainWindow.webContents.on('did-finish-load', () => {
    win.mainWindow?.webContents.send('config:preload', { config, isFirstLaunch });
  });

  // 4. When main window finishes loading, wait a minimum time then transition
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

  // Setup crash listeners on main window
  setupCrashListeners(win.mainWindow);

  // Minimum splash display time (1.5s)
  setTimeout(() => {
    splashMinTimeDone = true;
    tryTransition();
  }, 1500);
});

app.on('window-all-closed', () => {
  flushConfig();
  app.quit();
});

app.on('activate', () => {
  if (electron.BrowserWindow.getAllWindows().length === 0) {
    win.mainWindow = createMainWindow();
  }
});
