import { ipcInvoke, onIpcEvent } from "./ipc";

/** 强制升级页面状态（主进程 electron/core/forced-update.ts 的状态机） */
export type ForcedUpdateState =
  | "idle"
  | "resolving"
  | "downloading"
  | "downloaded"
  | "installing"
  | "error";

/** 主进程广播的强制升级状态 payload（forced-update:status） */
export interface ForcedUpdateStatus {
  state: ForcedUpdateState;
  /** 下载进度（0-100） */
  percent: number;
  transferred: number;
  total: number;
  /** 目标版本（不含 v 前缀，如 1.2.7-44） */
  version?: string;
  /** 安装包文件名 */
  fileName?: string;
  /** 是否开发模式（dev 下点击安装仅重启） */
  dev: boolean;
  error?: string;
}

/**
 * 进入强下载页面：解析目标版本 → 检查本地是否已有符合要求的安装包 → 没有则开始下载。
 * @param targetVersion API 下发的目标版本（可空，空则取最新正式版）
 */
export const prepareForcedUpdate = (targetVersion?: string): Promise<ForcedUpdateStatus> =>
  ipcInvoke<ForcedUpdateStatus>("forced-update:prepare", { targetVersion });

/** 点击「立即安装」：不校验，直接静默安装（dev 下仅重启应用） */
export const installForcedUpdate = (): Promise<ForcedUpdateStatus | null> =>
  ipcInvoke<ForcedUpdateStatus | null>("forced-update:install");

/** 读取当前状态快照（进入页面前先看是否有进行中的下载） */
export const getForcedUpdateState = (): Promise<ForcedUpdateStatus> =>
  ipcInvoke<ForcedUpdateStatus>("forced-update:getState");

/** 订阅强制升级状态变化（下载进度 / 完成 / 错误） */
export const onForcedUpdateStatus = (
  cb: (status: ForcedUpdateStatus) => void,
): (() => void) => onIpcEvent<ForcedUpdateStatus>("forced-update:status", cb);
