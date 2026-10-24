import { ipcInvoke, onIpcEvent } from './ipc';

/**
 * Koring Account 启动器 API（渲染端封装）。
 *
 * 网络请求与 API KEY 全部在主进程（electron/core/launcher-api.ts）：
 * 打包后渲染进程 origin 为 file://，直连 Account 服务会被 CORS 拦截。
 * 本模块只做 IPC 调用与类型镜像。
 */

/** 通知对象（设备通知与版本通知结构一致，见 docs/LAUNCHER-API.MD §6.2） */
export interface LauncherNotification {
  id: string;
  /** info | warning | danger | vulnerability | event */
  level: string;
  title: string;
  publisher?: string;
  published_at?: string;
  content?: string;
  link_url?: string | null;
}

export interface DeviceBlacklist {
  reason?: string;
  permanent?: boolean;
  created_at?: string;
  expires_at?: string | null;
}

export interface DeviceBoundUser {
  uuid?: string;
  nickname?: string;
  avatar_url?: string | null;
}

export interface DeviceStatusData {
  recorded: boolean;
  device_id?: string;
  smbios_uuid?: string;
  os?: string | null;
  os_version?: string | null;
  timezone?: string | null;
  country_code?: string | null;
  language?: string | null;
  app_version?: string | null;
  first_seen_at?: string;
  last_seen_at?: string;
  report_count?: number;
  blacklisted: boolean;
  blacklist: DeviceBlacklist | null;
  bound_user: DeviceBoundUser | null;
  notifications: LauncherNotification[];
  /** 服务端下发的开发者模式开关 */
  developer_mode?: boolean;
}

/** 设备校验结果（未登记时主进程会自动上报一次） */
export interface DeviceCheckResult {
  uuid: string;
  uuid_source: 'smbios' | 'fingerprint' | 'none';
  reported: boolean;
  recorded: boolean;
  blacklisted: boolean;
  blacklist: DeviceBlacklist | null;
  bound_user: DeviceBoundUser | null;
  notifications: LauncherNotification[];
  /** 服务端下发的开发者模式开关（设置页「开发者选项」入口据此显示） */
  developer_mode: boolean;
  /** 是否为打包产物（false=开发模式：服务不可用时允许跳过） */
  enforced: boolean;
}

/** 版本策略（含主进程的升级判定） */
export interface VersionPolicyResult {
  known: boolean;
  version: string;
  channel: 'stable' | 'beta' | 'legacy' | null;
  is_legacy: boolean;
  activation_blocked: boolean;
  block_reason: string | null;
  force_upgrade: boolean;
  min_upgrade_version: string | null;
  upgrade_target_version: string | null;
  resolved_upgrade_target: string | null;
  latest_stable: string | null;
  latest_beta: string | null;
  notifications: LauncherNotification[];
  needs_upgrade: boolean;
  upgrade_target: string | null;
  /** 是否为打包产物（false=开发模式：服务不可用时允许跳过） */
  enforced: boolean;
}

export type StartupBlockKind = 'device_blacklisted' | 'activation_blocked' | 'force_upgrade';

export interface StartupCheckResult {
  device: { ok: boolean; data: DeviceCheckResult | null; error: string | null };
  policy: { ok: boolean; data: VersionPolicyResult | null; error: string | null };
  allowed: boolean;
  block: StartupBlockKind | null;
  /** 仅打包产物执行阻断；未打包（开发）只查询不拦 */
  enforced: boolean;
}

export interface SmbiosUuidResult {
  uuid: string;
  source: 'smbios' | 'fingerprint' | 'none';
}

/** 主进程环境信息（不发起网络请求） */
export interface LauncherEnvInfo {
  /** 是否为打包产物；false=开发模式（校验服务不可用时 UI 允许跳过） */
  enforced: boolean;
  /** 当前生效的 API 服务地址 */
  api_base: string;
}

/** 环境信息（enforced / apibase） */
export function launcherEnvInfo(): Promise<LauncherEnvInfo> {
  return ipcInvoke<LauncherEnvInfo>('launcher-api:env-info');
}

/** 设备校验：未登记 → 自动上报一次 → 返回最新状态（黑名单是正常数据，不抛错） */
export function launcherDeviceCheck(): Promise<DeviceCheckResult> {
  return ipcInvoke<DeviceCheckResult>('launcher-api:device-check');
}

/** 版本策略查询（默认当前程序版本） */
export function launcherVersionPolicy(version?: string): Promise<VersionPolicyResult> {
  return ipcInvoke<VersionPolicyResult>('launcher-api:version-policy', { version });
}

/** 启动检查（设备 + 版本，主进程侧 30s 缓存） */
export function launcherStartupCheck(force = false): Promise<StartupCheckResult> {
  return ipcInvoke<StartupCheckResult>('launcher-api:startup-check', { force });
}

/** 本机设备标识（SMBIOS UUID，缺失时回退设备指纹） */
export function launcherDeviceUuid(): Promise<SmbiosUuidResult> {
  return ipcInvoke<SmbiosUuidResult>('launcher-api:device-uuid');
}

/** 原始设备状态查询（不做上报） */
export function launcherDeviceStatus(): Promise<DeviceStatusData> {
  return ipcInvoke<DeviceStatusData>('launcher-api:device-status');
}

/** 强制上报一次设备信息 */
export function launcherDeviceReport(): Promise<DeviceStatusData> {
  return ipcInvoke<DeviceStatusData>('launcher-api:device-report');
}

/** 设备维度通知 */
export function launcherDeviceNotifications(): Promise<LauncherNotification[]> {
  return ipcInvoke<LauncherNotification[]>('launcher-api:device-notifications');
}

// ==================== 设备心跳（每 2 分钟一次 POST /device/report） ====================

/** 心跳事件载荷（主进程在每次成功上报后广播） */
export interface DeviceHeartbeatEvent {
  /** 本次上报完成的时间戳（ms） */
  at: number;
  /** 服务端返回的最新设备状态 */
  status: DeviceStatusData;
}

/** 订阅设备心跳（每次心跳成功上报一次就回调一次；返回取消订阅函数） */
export function onLauncherDeviceHeartbeat(
  callback: (event: DeviceHeartbeatEvent) => void,
): () => void {
  return onIpcEvent<DeviceHeartbeatEvent>('launcher-api:device-updated', callback);
}

/** 设备心跳运行信息（调试页展示） */
export interface LauncherHeartbeatInfo {
  interval_ms: number;
  count: number;
  last: DeviceHeartbeatEvent | null;
  running: boolean;
}

/** 读取设备心跳运行信息 */
export function launcherHeartbeatInfo(): Promise<LauncherHeartbeatInfo> {
  return ipcInvoke<LauncherHeartbeatInfo>('launcher-api:heartbeat-info');
}
