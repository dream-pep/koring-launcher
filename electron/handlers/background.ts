import electron from 'electron';
import fs from 'fs';
import path from 'path';
import { loadConfig, saveConfig } from '../config';
import type { BackgroundMode } from '../config';
import { importMediaFile, importUserBackground, isManagedBackgroundFile, isPathInside } from '../core/background-image';
import { backgroundResourceUrl } from '../resource-protocol';
import { createLogger } from '../core/logger';

const { ipcMain } = electron;

const log = createLogger('background');

interface WinRef {
  mainWindow: electron.BrowserWindow | null;
}

/** 与 electron/config.ts 的 DEFAULTS.background 保持一致（恢复默认用） */
const DEFAULT_BACKGROUND = {
  bgType: 'image' as BackgroundMode,
  image: '/background.png',
  images: [] as string[],
  imageRotateSeconds: 30,
  video: '',
  color: '#1c1c1e',
  blur: 0,
  opacity: 100,
};

const MODES: BackgroundMode[] = ['mica', 'color', 'image', 'video', 'gif'];

function isMode(value: unknown): value is BackgroundMode {
  return typeof value === 'string' && MODES.includes(value as BackgroundMode);
}

/** 配置里所有仍被引用的受管文件（清理旧缓存时保留） */
function keepPathsOf(bg: { images?: string[]; image?: string; video?: string }): string[] {
  return [bg.image, bg.video, ...(bg.images ?? [])]
    .filter((p): p is string => typeof p === 'string' && !!p && path.isAbsolute(p));
}

/** 从磁盘删除单个受管背景文件（仅限 userData 内的 background-custom* 白名单） */
function deleteManagedFile(filePath: string): void {
  try {
    if (!filePath || !path.isAbsolute(filePath)) return;
    const userDataDir = electron.app.getPath('userData');
    if (!isPathInside(userDataDir, filePath)) return;
    if (!isManagedBackgroundFile(path.basename(filePath))) return;
    fs.unlinkSync(filePath);
  } catch {
    // 文件被占用/已删除：忽略
  }
}

/**
 * 把 Mica 材质应用到主窗口。
 * - 透明窗口只能在创建时决定（electron/main.ts 依据启动时的配置传入），
 *   运行中切换模式时返回 requiresRestart，渲染端提示重启生效。
 */
function applyWindowMode(win: WinRef, mode: BackgroundMode): { requiresRestart: boolean } {
  const main = win.mainWindow;
  if (!main || main.isDestroyed()) return { requiresRestart: false };
  const createdTransparent = Boolean((main as unknown as { __bgTransparent?: boolean }).__bgTransparent);
  try {
    main.setBackgroundMaterial(mode === 'mica' ? 'mica' : 'none');
    if (mode === 'mica') main.setBackgroundColor('#00000000');
  } catch (e) {
    log.warn(`应用窗口材质失败（非 Windows 11 或平台不支持）: ${String(e)}`);
  }
  return { requiresRestart: mode === 'mica' && !createdTransparent };
}

export function registerBackgroundHandlers(win: WinRef) {
  const respond = <T>(data: T) => ({ success: true, data, error: null });
  const fail = (e: unknown) => ({ success: false, data: null, error: String(e) });

  ipcMain.handle('background:get', async () => {
    try {
      return respond(loadConfig().background);
    } catch (e: unknown) {
      return fail(e);
    }
  });

  // 切换背景模式：Mica / 纯色 / 图片 / 视频 / GIF
  ipcMain.handle('background:set-mode', async (_event, payload: { mode: BackgroundMode }) => {
    try {
      if (!isMode(payload?.mode)) return fail(new Error('无效的背景模式'));
      const config = loadConfig();
      config.background.bgType = payload.mode;
      saveConfig(config);
      const { requiresRestart } = applyWindowMode(win, payload.mode);
      log.info(`背景模式切换 → ${payload.mode}${requiresRestart ? '（需重启生效）' : ''}`);
      return { success: true, data: config.background, requiresRestart, error: null };
    } catch (e: unknown) {
      return fail(e);
    }
  });

  // 纯色
  ipcMain.handle('background:set-color', async (_event, payload: { color: string }) => {
    try {
      const color = typeof payload?.color === 'string' && payload.color.trim() ? payload.color.trim() : DEFAULT_BACKGROUND.color;
      const config = loadConfig();
      config.background.bgType = 'color';
      config.background.color = color;
      config.background.image = color;
      saveConfig(config);
      return respond(config.background);
    } catch (e: unknown) {
      return fail(e);
    }
  });

  // 图片模式：一次导入多张（复制进 userData、按屏幕尺寸优化，配置只存路径）
  ipcMain.handle('background:add-images', async (_event, payload: { paths: string[]; maxEdge?: number }) => {
    try {
      const paths = Array.isArray(payload?.paths) ? payload.paths.filter((p) => typeof p === 'string' && p) : [];
      if (paths.length === 0) return { success: true, data: { background: loadConfig().background, added: 0, failed: 0 }, error: null };
      const config = loadConfig();
      const bg = config.background;
      bg.images = Array.isArray(bg.images) ? bg.images : [];
      // 首次添加时清掉默认壁纸占位（没有真实文件可保留）
      bg.images = bg.images.filter((p) => path.isAbsolute(p));
      let added = 0;
      let failed = 0;
      for (const srcPath of paths) {
        const result = importUserBackground(srcPath, payload.maxEdge || 4096, keepPathsOf(bg));
        if (!result?.filePath) {
          failed += 1;
          continue;
        }
        if (!bg.images.includes(result.filePath)) bg.images.push(result.filePath);
        added += 1;
      }
      bg.bgType = 'image';
      if (bg.images.length > 0) bg.image = bg.images[0];
      saveConfig(config);
      log.info(`导入轮换壁纸：成功 ${added}，失败 ${failed}，共 ${bg.images.length} 张`);
      return { success: true, data: { background: bg, added, failed }, error: null };
    } catch (e: unknown) {
      return fail(e);
    }
  });

  // 删除轮换列表中的一张
  ipcMain.handle('background:remove-image', async (_event, payload: { path: string }) => {
    try {
      const config = loadConfig();
      const bg = config.background;
      const target = payload?.path;
      bg.images = (Array.isArray(bg.images) ? bg.images : []).filter((p) => p !== target);
      if (bg.image === target) bg.image = bg.images[0] ?? '';
      saveConfig(config);
      if (typeof target === 'string') deleteManagedFile(target);
      return respond(bg);
    } catch (e: unknown) {
      return fail(e);
    }
  });

  // 轮换间隔（秒）；0 = 不轮换
  ipcMain.handle('background:set-rotate', async (_event, payload: { seconds: number }) => {
    try {
      const seconds = Math.max(0, Math.min(3600, Math.round(Number(payload?.seconds) || 0)));
      const config = loadConfig();
      config.background.imageRotateSeconds = seconds;
      saveConfig(config);
      return respond(config.background);
    } catch (e: unknown) {
      return fail(e);
    }
  });

  // 视频背景（不做重编码；渲染端强制静音播放）
  ipcMain.handle('background:set-video', async (_event, payload: { srcPath: string }) => {
    try {
      const config = loadConfig();
      const bg = config.background;
      const result = importMediaFile(payload?.srcPath, 'video', keepPathsOf(bg));
      if (!result) return fail(new Error('视频导入失败'));
      const oldVideo = bg.video;
      bg.bgType = 'video';
      bg.video = result.filePath;
      saveConfig(config);
      if (oldVideo && oldVideo !== result.filePath) deleteManagedFile(oldVideo);
      return respond(bg);
    } catch (e: unknown) {
      return fail(e);
    }
  });

  // GIF 背景（保留动画，不做重编码）
  ipcMain.handle('background:set-gif', async (_event, payload: { srcPath: string }) => {
    try {
      const config = loadConfig();
      const bg = config.background;
      const result = importMediaFile(payload?.srcPath, 'gif', keepPathsOf(bg));
      if (!result) return fail(new Error('GIF 导入失败'));
      const old = bg.image;
      bg.bgType = 'gif';
      bg.image = result.filePath;
      saveConfig(config);
      // 旧 GIF 可能是被列表引用的图，避免误删
      if (old && old !== result.filePath && !(bg.images ?? []).includes(old)) deleteManagedFile(old);
      return respond(bg);
    } catch (e: unknown) {
      return fail(e);
    }
  });

  // 旧接口：单图设置（兼容）
  ipcMain.handle('background:set-image', async (_event, payload: { url: string; blur?: number; opacity?: number }) => {
    try {
      const config = loadConfig();
      config.background.bgType = 'image';
      config.background.image = payload.url;
      if (Array.isArray(config.background.images) && payload.url) {
        config.background.images = [payload.url];
      }
      if (payload.blur !== undefined) config.background.blur = payload.blur;
      if (payload.opacity !== undefined) config.background.opacity = payload.opacity;
      saveConfig(config);
      return respond(config.background);
    } catch (e: unknown) {
      return fail(e);
    }
  });

  ipcMain.handle('background:set-blur', async (_event, payload: { blur: number }) => {
    try {
      const config = loadConfig();
      config.background.blur = payload.blur;
      saveConfig(config);
      return respond(config.background);
    } catch (e: unknown) {
      return fail(e);
    }
  });

  ipcMain.handle('background:set-opacity', async (_event, payload: { opacity: number }) => {
    try {
      const config = loadConfig();
      config.background.opacity = payload.opacity;
      saveConfig(config);
      return respond(config.background);
    } catch (e: unknown) {
      return fail(e);
    }
  });

  ipcMain.handle('background:set-animation', async () => {
    try {
      return respond(loadConfig().background);
    } catch (e: unknown) {
      return fail(e);
    }
  });

  ipcMain.handle('background:set-theme', async (_event, payload: { theme: string }) => {
    try {
      const config = loadConfig();
      config.theme.darkMode = payload.theme;
      saveConfig(config);
      return respond(config.background);
    } catch (e: unknown) {
      return fail(e);
    }
  });

  ipcMain.handle('background:reset', async () => {
    try {
      const config = loadConfig();
      const previous = loadConfig().background;
      config.background = { ...DEFAULT_BACKGROUND, images: [] };
      saveConfig(config);
      const { requiresRestart } = applyWindowMode(win, 'image');
      // 清理不再被引用的受管文件
      for (const p of keepPathsOf(previous)) deleteManagedFile(p);
      return { success: true, data: config.background, requiresRestart, error: null };
    } catch (e: unknown) {
      return fail(e);
    }
  });

  // 导入自选壁纸（旧接口，单图）
  ipcMain.handle('background:import', async (_event, payload: { srcPath: string; maxEdge?: number }) => {
    try {
      const config = loadConfig();
      const result = importUserBackground(payload.srcPath, payload.maxEdge || 4096, keepPathsOf(config.background));
      return { success: true, data: result, error: null };
    } catch (e: unknown) {
      return fail(e);
    }
  });

  // 把配置/Store 中的「背景值」解析为可显示的资源引用：
  // - data:/http(s):/file: 及 /、./ 相对 URL → 原样返回（本身可直接用于 CSS）；
  // - userData 内的受管背景文件（图片/视频/GIF）→ koring-res:// 协议 URL（流式读取，无 base64 副本）；
  // - 其它（越权路径/不存在等）→ data:null，调用方回退默认背景。
  ipcMain.handle('background:resolve', async (_event, payload: { value?: string }) => {
    try {
      const value = typeof payload?.value === 'string' ? payload.value.trim() : '';
      if (!value) return { success: true, data: null, error: null };
      if (/^(data:|https?:|file:|\.\.\/|\/|\.\/)/i.test(value)) {
        return { success: true, data: { url: value, bytes: 0 }, error: null };
      }
      const userDataDir = electron.app.getPath('userData');
      if (!path.isAbsolute(value) || !isPathInside(userDataDir, value)) {
        return { success: true, data: null, error: null };
      }
      const fileName = path.basename(value);
      if (!isManagedBackgroundFile(fileName)) {
        return { success: true, data: null, error: null };
      }
      const stat = fs.statSync(value);
      if (!stat.isFile()) return { success: true, data: null, error: null };
      return {
        success: true,
        data: { url: backgroundResourceUrl(fileName), bytes: stat.size },
        error: null,
      };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });
}
