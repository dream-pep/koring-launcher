/**
 * 陶瓦联机（Terracotta）IPC handlers。
 *
 * 统一返回 `{ success, data, error }`（与现有 handlers 一致）；所有异常在这里收敛成
 * 可读的 error 文案，渲染进程拿到的永远是结构化结果。
 *
 * 事件：
 * - `terracotta:status`：状态 / 成员 / 安装进度变化时广播（带 diff 过滤）
 * - `terracotta:install-progress`：安装进度（≥100ms 节流）
 */
import electron from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import {
  terracottaService,
  type TcGuestPayload,
  type TcHostPayload,
  type TcStartPayload,
} from '../core/terracotta';
import { probeTerracottaNodes } from '../core/terracotta-nodes';
import { isValidRoomCode } from '../core/terracotta-protocol';

const { ipcMain, dialog, shell, BrowserWindow } = electron;

interface WinRef {
  mainWindow: electron.BrowserWindow | null;
}

interface IpcResult<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}

function fail(error: string): IpcResult<null> {
  return { success: false, data: null, error };
}

/** 把同步/异步 handler 的异常统一转成 { success:false, error } */
async function guard<T>(action: () => T | Promise<T>): Promise<IpcResult<T>> {
  try {
    const data = await action();
    return { success: true, data, error: null };
  } catch (e) {
    return { success: false, data: null, error: e instanceof Error ? e.message : String(e) };
  }
}

export function registerTerracottaHandlers(win: WinRef) {
  // 注入广播函数：发到所有窗口（主窗口 + 可能存在的其他窗口都保持一致）
  terracottaService.setBroadcaster((channel, payload) => {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) {
        window.webContents.send(channel, payload);
      }
    }
  });

  // 当前完整状态（二进制信息 + 进程状态 + 快照 + 安装状态）
  ipcMain.handle('terracotta:status', () => guard(() => terracottaService.getStatus()));

  // 运行时下载安装；立即返回当前状态，进度走事件
  ipcMain.handle(
    'terracotta:install',
    (_event, payload: { force?: boolean } | undefined) =>
      guard(() => terracottaService.install(Boolean(payload?.force))),
  );

  // 启动 / 停止
  ipcMain.handle('terracotta:start', (_event, payload: TcStartPayload | undefined) =>
    guard(() => terracottaService.start(payload)),
  );
  ipcMain.handle('terracotta:stop', () => guard(() => terracottaService.stop()));

  // 开房 / 加入房间
  ipcMain.handle('terracotta:host', (_event, payload: TcHostPayload | undefined) =>
    guard(() => terracottaService.host(payload ?? {})),
  );
  ipcMain.handle('terracotta:guest', (_event, payload: TcGuestPayload | undefined) => {
    const room = (payload?.room ?? '').trim();
    // 本地预校验：格式不对直接返回可读文案，不必先启动服务再等上游 400
    if (!isValidRoomCode(room)) {
      return Promise.resolve(fail('房间码格式不正确，请检查后重试'));
    }
    return guard(() => terracottaService.guest({ ...(payload as TcGuestPayload), room }));
  });

  // 重置回 waiting（非 waiting 下可能让进程消失，服务内部按「已停止」处理）
  ipcMain.handle('terracotta:reset', () => guard(() => terracottaService.reset()));

  // 读取上游 application.log
  ipcMain.handle('terracotta:fetch-log', () =>
    guard(async () => ({ content: await terracottaService.fetchLog() })),
  );

  // 打开数据目录
  ipcMain.handle('terracotta:open-dir', () =>
    guard(async () => {
      const dir = terracottaService.getDataDir();
      fs.mkdirSync(dir, { recursive: true });
      const error = await shell.openPath(dir);
      if (error) throw new Error(`打开目录失败：${error}`);
      return { path: dir };
    }),
  );

  // 选择本地二进制（取消返回 null，渲染端据此忽略）
  ipcMain.handle('terracotta:pick-binary', () =>
    guard(async () => {
      const filters =
        process.platform === 'win32'
          ? [{ name: '可执行文件', extensions: ['exe'] }]
          : [{ name: '可执行文件', extensions: ['*'] }];
      const result = win.mainWindow
        ? await dialog.showOpenDialog(win.mainWindow, { properties: ['openFile'], filters })
        : await dialog.showOpenDialog({ properties: ['openFile'], filters });
      if (result.canceled || result.filePaths.length === 0) return null;
      return { path: path.resolve(result.filePaths[0]) };
    }),
  );

  // 清除自定义二进制路径，恢复自动定位
  ipcMain.handle('terracotta:clear-binary', () =>
    guard(() => terracottaService.clearCustomBinary()),
  );

  // 公共节点连通性检测：不启动任何进程，只做 DNS / TCP / HTTP 探测
  ipcMain.handle('terracotta:check-nodes', (_event, payload: unknown) =>
    guard(async () => {
      // 兼容三种入参：string[]、{ nodes: string[] }、undefined（用配置里的节点）
      const raw = payload as { nodes?: unknown } | string[] | undefined;
      const requested = Array.isArray(raw) ? raw : Array.isArray(raw?.nodes) ? raw.nodes : null;
      const source = (requested ?? terracottaService.getPublicNodes())
        .map((item) => String(item ?? '').trim())
        .filter(Boolean);
      return { nodes: await probeTerracottaNodes(source) };
    }),
  );
}
