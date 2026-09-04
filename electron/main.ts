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
import { registerUpdateHandlers } from './handlers/update';
import { updateService } from './updater';
import { saveConfig, configExists, getConfig, flushConfig, configPath } from './config';
import { findCachedBackgroundRaw, optimizeBackgroundFile, recoverBackgroundFromDataUrl } from './core/background-image';
import { registerResourceSchemePrivileges, registerResourceProtocol } from './resource-protocol';
import { createLogger, setDebugModeProvider, installIpcLogging, registerRendererLogBridge } from './core/logger';

const { app } = electron;

const isDev = !app.isPackaged;

// 统一日志：debug 模式（config.advanced.debugMode）→ 控制台 + userData/koring.log；否则仅控制台
const log = createLogger('main');
setDebugModeProvider(() => {
  try {
    return getConfig()?.advanced?.debugMode === true;
  } catch {
    return false;
  }
});
// 全局包装 ipcMain.handle：所有 IPC 流程自动带 channel/耗时/成败日志（须在 handler 注册前调用）
installIpcLogging();

// GPU acceleration flags
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');

// 自定义资源协议（koring-res://）特权注册：必须在 app ready 之前完成
registerResourceSchemePrivileges();

const win: { mainWindow: electron.BrowserWindow | null; splashWindow: electron.BrowserWindow | null } = {
  mainWindow: null,
  splashWindow: null,
};

// 首次启动标记（由 runStartupChecks 决定）；窗口每次加载/刷新时随 config:preload 一起推送
let isFirstLaunchFlag = false;

// 迁移旧版「安装目录」存储 → userData（仅打包模式）。配置必须存 userData 才能跨重装/更新
// 存活：NSIS 每次重装/升级会经旧卸载器删除整个安装目录（RMDir /r），/KEEP_APP_DATA 只保护 %APPDATA%。
// 复制而非移动，避免破坏用户已有文件；userData 已有目标文件则跳过。
function migrateLegacyFiles(): void {
  if (!app.isPackaged) return;
  const exeDir = path.dirname(app.getPath('exe'));
  const src = path.join(exeDir, 'Koring.yml');
  if (!fs.existsSync(src)) return;
  const dest = path.join(app.getPath('userData'), 'Koring.yml');
  if (fs.existsSync(dest)) return;
  try {
    fs.copyFileSync(src, dest);
    log.info(`[migrate] 已复制 Koring.yml ${src} → ${dest}`);
  } catch (e) {
    log.error('[migrate] 复制 Koring.yml 失败:', e);
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
    // 首次启动：全量写入，确保配置文件在安装目录可见（稀疏保存下全默认不落盘）
    saveConfig(config, true);
  }

  return { isFirstLaunch, config };
}

// 迁移旧版「配置里存 BASE64 dataURL」→ 「存文件路径」：
// 优先使用 userData 里已有的原始缓存；没有缓存时直接把 dataURL 解码落盘，
// 保证任意旧配置都能改写成文件路径（显示内容与原 dataURL 完全一致）。
function migrateBackgroundDataUrlToPath(config: ReturnType<typeof getConfig>): void {
  const bg = config?.background;
  if (!bg || bg.bgType !== 'image' || typeof bg.image !== 'string' || !bg.image.startsWith('data:')) {
    return;
  }
  try {
    const userDataDir = app.getPath('userData');
    const raw = findCachedBackgroundRaw(userDataDir) ?? recoverBackgroundFromDataUrl(bg.image, userDataDir);
    if (!raw) return;
    const result = optimizeBackgroundFile(raw, 4096);
    if (!result || !result.filePath) return;
    bg.image = result.filePath;
    saveConfig(config);
    log.info(`[background] 迁移：dataURL → 文件路径 ${result.filePath}`);
  } catch (e) {
    log.error('[background] 背景配置迁移失败:', e);
  }
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

  // 每次页面加载完成（含 Ctrl+R / F5 刷新、HMR 全量重载）都推送【最新权威配置】给渲染端：
  // - 用 getConfig()（主进程内存权威）而非启动时的快照，刷新后拿到的是当前值而不是过期快照
  // - 监听器挂在具体窗口实例上，后续重建的窗口（如 macOS activate）也能收到
  main.webContents.on('did-finish-load', () => {
    if (main.isDestroyed()) return;
    main.webContents.send('config:preload', { config: getConfig(), isFirstLaunch: isFirstLaunchFlag });
  });

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
  registerUpdateHandlers();
}

app.whenReady().then(() => {
  log.info('应用就绪，开始初始化主进程');
  registerAllHandlers();
  registerResourceProtocol();
  registerRendererLogBridge();
  log.info('IPC handlers / 资源协议 / 渲染日志桥注册完成');

  // Migrate legacy install-dir config back to userData before anything reads them
  migrateLegacyFiles();

  // Run startup checks before creating windows
  const { isFirstLaunch, config } = runStartupChecks();
  isFirstLaunchFlag = isFirstLaunch;
  log.info(`启动检查完成 isFirstLaunch=${isFirstLaunch} 配置路径=${configPath()}`);

  // 旧配置中 background.image 若是 BASE64 dataURL → 落盘优化并改写为文件路径
  migrateBackgroundDataUrlToPath(config);

  // 1. Show splash immediately
  win.splashWindow = createSplashWindow();
  log.info('Splash 窗口已创建');

  // 2. Create main window in background
  //    （config:preload 推送已内置于 createMainWindow 的 did-finish-load 监听，
  //     每次加载/刷新都推送 getConfig() 的最新内存配置）
  win.mainWindow = createMainWindow();
  log.info('主窗口已创建（后台加载）');

  // 3. When main window finishes loading, wait a minimum time then transition
  let mainReady = false;
  let splashMinTimeDone = false;

  const tryTransition = () => {
    if (mainReady && splashMinTimeDone) {
      if (win.mainWindow && !win.mainWindow.isDestroyed()) {
        win.mainWindow.show();
        win.mainWindow.focus();
        log.info('主窗口已显示，切换完成');
      }
      if (win.splashWindow && !win.splashWindow.isDestroyed()) {
        win.splashWindow.close();
        win.splashWindow = null;
        log.info('Splash 窗口已关闭');
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

  // 延迟静默检查更新（避开启动加载，不抢带宽；开发模式在 updater.init 内自动跳过）
  setTimeout(() => {
    log.info('触发启动静默更新检查');
    updateService.check(false).catch((e) => {
      log.error('[updater] 启动静默检查失败:', e);
    });
  }, 12000);
});

app.on('window-all-closed', () => {
  log.info('所有窗口已关闭，flush 配置并退出');
  flushConfig();
  app.quit();
});

app.on('activate', () => {
  if (electron.BrowserWindow.getAllWindows().length === 0) {
    log.info('activate：重建主窗口');
    win.mainWindow = createMainWindow();
  }
});
