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

/** 更新通道定义（主进程注册表，可扩展） */
export interface UpdateChannelDef {
  key: string;
  label: string;
  desc: string;
  allowPrerelease: boolean;
}

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
  /** 当前更新通道（woker / runner） */
  channel?: string;
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

/** 获取更新通道定义列表（UI 动态渲染，可扩展） */
export const getUpdateChannels = (): Promise<UpdateChannelDef[]> =>
  ipcInvoke<UpdateChannelDef[]>("update:getChannels");

/** 切换更新通道（woker 慢走 / runner 跑步；持久化并立即生效） */
export const setUpdateChannel = (channel: string): Promise<UpdateStatusPayload> =>
  ipcInvoke<UpdateStatusPayload>("update:setChannel", { channel });

/** 开发者工具：设置测试版本号（覆盖当前识别版本） */
export const setTestVersion = (version: string): Promise<UpdateStatusPayload> =>
  ipcInvoke<UpdateStatusPayload>("update:setTestVersion", { version });

/** 开发者工具：版本比对结果 */
export interface VersionCompareResult {
  a: string;
  b: string;
  result: "a>b" | "a<b" | "a==b" | "invalid";
  detail: string;
}

/** 开发者工具：版本比对（semver） */
export const compareVersions = (a: string, b: string): Promise<VersionCompareResult> =>
  ipcInvoke<VersionCompareResult>("update:compareVersions", { a, b });
