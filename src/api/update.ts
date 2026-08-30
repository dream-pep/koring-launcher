import { ipcInvoke, onIpcEvent } from "./ipc";

/** 更新状态（主进程 electron/updater.ts 的状态机） */
export type UpdateState =
  | "idle"
  | "checking"
  | "available"
  | "not-available"
  | "downloading"
  | "paused"
  | "downloaded"
  | "installing"
  | "error";

/** 主进程广播的更新状态 payload（update:status） */
export interface UpdateStatusPayload {
  state: UpdateState;
  /** 是否为手动触发（手动触发时前端不弹提示） */
  manual: boolean;
  /** 最新版本号 */
  version?: string;
  /** 当前安装版本 */
  currentVersion?: string;
  percent?: number;
  transferred?: number;
  total?: number;
  bytesPerSecond?: number;
  /** 当前使用的更新源（github / 加速源域名） */
  source?: string;
  error?: string;
}

/** 兼容旧调用方的下载进度结构 */
export interface DownloadProgress {
  downloaded: number;
  contentLength: number;
  percent: number;
}

/** 主进程 update:getReleaseNotes 返回的发布说明数据 */
export interface ReleaseNotesResult {
  /** release tag，如 v1.2.0-2608271921 */
  tag: string;
  /** 版本号（去 v 前缀） */
  version: string;
  /** 发布说明原始 Markdown */
  notes: string;
  /** 读取来源：github / 加速源域名 */
  source: string;
  /** 是否为最新版本的说明（当前版本无发布说明时回退） */
  isLatest: boolean;
}

/** 检查更新（manual=true 表示用户手动点击，前端不弹提示） */
export const checkForUpdates = (manual = false): Promise<UpdateStatusPayload> =>
  ipcInvoke<UpdateStatusPayload>("update:check", { manual });

/** 触发下载更新（进度经 update:status 事件上报）；paused 状态下调用即继续 */
export const downloadUpdate = (): Promise<null> => ipcInvoke<null>("update:download");

/** 暂停下载（中断当前请求，保留进度） */
export const pauseUpdate = (): Promise<null> => ipcInvoke<null>("update:pause");

/** 继续下载 */
export const resumeUpdate = (): Promise<null> => ipcInvoke<null>("update:resume");

/** 取消下载（清除进度，回到可重新下载状态） */
export const cancelUpdate = (): Promise<null> => ipcInvoke<null>("update:cancel");

/** 退出并安装（NSIS 静默安装，安装完成自动重启） */
export const quitAndInstall = (): Promise<null> => ipcInvoke<null>("update:quitAndInstall");

/** 兼容旧调用（VersionCard「立即更新」按钮） */
export const relaunchApp = quitAndInstall;

/** 查询当前更新状态快照 */
export const getUpdateState = (): Promise<UpdateStatusPayload> => ipcInvoke<UpdateStatusPayload>("update:getState");

/**
 * 读取指定版本（默认当前安装版本）的发布说明。
 * 主进程内部：GitHub 直连优先，失败自动切换加速源；当前版本无说明时回退最新版本。
 */
export const getReleaseNotes = (tag?: string): Promise<ReleaseNotesResult | null> =>
  ipcInvoke<ReleaseNotesResult | null>("update:getReleaseNotes", { tag });

/** 订阅更新状态变化 */
export const onUpdateStatus = (cb: (status: UpdateStatusPayload) => void): (() => void) =>
  onIpcEvent<UpdateStatusPayload>("update:status", cb);
