/**
 * Koring Account 启动器 API 客户端（主进程）。
 *
 * 为什么必须在主进程发起：打包后渲染进程的 origin 是 file://，而 Account 服务
 * 默认不返回任何 Access-Control-* 头（见 docs/LAUNCHER-API.MD §1.7），渲染端
 * fetch 必然被 CORS 拦截；同时 API KEY 也不应下发到渲染层。
 *
 * 覆盖接口（scope device_service，认证头 X-API-Key）：
 *   - GET  /api/v1/device/status?uuid=…      查询设备状态（黑名单 / 绑定 / 通知）
 *   - POST /api/v1/device/report             上报本机信息（upsert，顺带完成登记）
 *   - GET  /api/v1/device/notifications?uuid= 设备维度通知
 *   - GET  /api/v1/launcher/version?version= 版本策略（禁激活 / 强制升级 / 版本通知）
 *
 * 服务地址与密钥来自环境变量 / .env（KORING_API_BASE / KORING_API_KEY，见 core/env.ts），
 * 不写死在代码里。
 *
 * 注意限流：设备四接口 + 版本两接口**共用** 120 次/分钟的桶（按 IP），
 * 因此启动检查做了进程内缓存，且不做任何高频轮询。
 */
import electron from 'electron';
import { createLogger } from './logger';
import { getEnv, getEnvBase } from './env';
import { getOsInfo, getSmbiosUuid, type SmbiosUuidSource } from './device-id';
import { compareVersionTags } from '../updater';

const { app } = electron;

const log = createLogger('core/launcher-api');

const REQUEST_TIMEOUT_MS = 10000;
/** 启动检查结果缓存时长：吸收 Ctrl+R 刷新/重复挂载导致的重复请求 */
const STARTUP_CACHE_MS = 30_000;

/**
 * 是否执行阻断（enforced）：
 * - 打包产物：始终阻断；
 * - 开发（未打包）：默认只查询不拦，避免后端异常把开发环境锁死；
 *   需要验证黑名单/禁激活 UI 时用环境变量 KORING_ENFORCE=1 强制启用。
 */
function isEnforced(): boolean {
  return app.isPackaged || process.env.KORING_ENFORCE === '1';
}

/**
 * API 配置（全部来自环境变量 / .env，不写死在代码里）：
 *   KORING_API_BASE  服务地址，如 https://account.koring.space
 *   KORING_API_KEY   后台创建的 device_service KEY（koring_ + 32 位）
 */
function apiConfig(): { base: string; key: string } {
  const base = getEnvBase('KORING_API_BASE');
  const key = getEnv('KORING_API_KEY');
  if (!base || !key) {
    throw new LauncherApiError(
      'api_not_configured',
      '未配置 KORING_API_BASE / KORING_API_KEY，请检查 .env 文件后重试',
    );
  }
  return { base, key };
}

/** 当前生效的服务地址（未配置返回空串；仅用于日志/展示） */
export function apiBase(): string {
  return getEnvBase('KORING_API_BASE');
}

// ==================== 数据结构 ====================

/** 通知对象（设备通知与版本通知结构完全一致，见文档 §6.2） */
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

/** GET /device/status 与 POST /device/report 的 data */
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
  /** 服务端下发的开发者模式开关（true 才在设置里显示「开发者选项」入口） */
  developer_mode?: boolean;
}

/** deviceCheck() 归一化结果（UI 直接消费） */
export interface DeviceCheckResult {
  uuid: string;
  /** smbios=原始 SMBIOS UUID；fingerprint=哈希指纹兜底 */
  uuid_source: SmbiosUuidSource;
  /** 本次是否执行了设备上报（未登记时会上报一次） */
  reported: boolean;
  recorded: boolean;
  blacklisted: boolean;
  blacklist: DeviceBlacklist | null;
  bound_user: DeviceBoundUser | null;
  notifications: LauncherNotification[];
  /** 服务端下发的开发者模式开关（设置页「开发者选项」入口据此显示） */
  developer_mode: boolean;
  /** 是否执行阻断（false=开发模式：服务不可用时允许跳过，见 UI） */
  enforced: boolean;
}

/** GET /launcher/version 的 data + 主进程判定结果 */
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
  /** 主进程判定：当前版本是否必须升级（force_upgrade 或低于 min_upgrade_version） */
  needs_upgrade: boolean;
  /** 主进程判定：要求/建议升级到的版本 */
  upgrade_target: string | null;
  /** 是否执行阻断（false=开发模式：服务不可用时允许跳过，见 UI） */
  enforced: boolean;
}

export type StartupBlockKind = 'device_blacklisted' | 'activation_blocked' | 'force_upgrade';

/** 启动检查（设备 + 版本，两者独立成败） */
export interface StartupCheckResult {
  device: { ok: boolean; data: DeviceCheckResult | null; error: string | null };
  policy: { ok: boolean; data: VersionPolicyResult | null; error: string | null };
  /** 是否允许进入主界面（无阻断项） */
  allowed: boolean;
  block: StartupBlockKind | null;
  /** 是否真正执行阻断（见 isEnforced） */
  enforced: boolean;
}

export interface DeviceReportPayload {
  uuid: string;
  os?: string;
  os_version?: string;
  timezone?: string;
  country?: string;
  language?: string;
  app_version?: string;
}

// ==================== 错误 ====================

export class LauncherApiError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  readonly details: unknown;

  constructor(code: string, message: string, httpStatus = 0, details?: unknown) {
    super(message);
    this.name = 'LauncherApiError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details;
  }
}

function toErrorText(e: unknown): string {
  if (e instanceof LauncherApiError) return e.message;
  if (e instanceof Error) return e.message || String(e);
  return String(e);
}

// ==================== 请求 ====================

interface RequestOptions {
  method?: 'GET' | 'POST';
  query?: Record<string, string | undefined>;
  body?: unknown;
}

/**
 * 统一信封解析：成功取 data，失败抛 LauncherApiError（code/message 直出给玩家）。
 */
async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { base, key } = apiConfig();
  const url = new URL(`${base}${path}`);
  for (const [param, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(param, value);
    }
  }

  const method = options.method ?? 'GET';
  const started = Date.now();
  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method,
      headers: {
        'X-API-Key': key,
        Accept: 'application/json',
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (e) {
    const reason = e instanceof Error && e.name === 'TimeoutError' ? '请求超时' : '网络不可达';
    log.warn(`[launcher-api] ${method} ${path} 失败：${reason} ${String(e)}`);
    throw new LauncherApiError('network_error', `无法连接校验服务（${reason}），请检查网络后重试`);
  }

  const raw = await res.text().catch(() => '');
  let json: unknown = null;
  try {
    json = raw ? JSON.parse(raw) : null;
  } catch {
    log.warn(`[launcher-api] ${method} ${path} 响应无法解析（HTTP ${res.status}）`);
    throw new LauncherApiError(
      'invalid_response',
      `校验服务返回了无法解析的内容（HTTP ${res.status}）`,
      res.status,
    );
  }

  const envelope = json as
    | { ok?: boolean; data?: unknown; error?: { code?: string; message?: string; details?: unknown } }
    | null;
  log.info(
    `[launcher-api] ${method} ${path} → ${res.status} ok=${String(envelope?.ok)} (${Date.now() - started}ms)`,
  );

  if (envelope && envelope.ok === true) {
    return envelope.data as T;
  }

  const err = envelope?.error;
  let message = err?.message || `请求失败（HTTP ${res.status}）`;
  const details = err?.details as { retry_after_seconds?: number } | undefined;
  if (err?.code === 'rate_limited' && details?.retry_after_seconds) {
    message = `${message}（请 ${details.retry_after_seconds} 秒后重试）`;
  }
  throw new LauncherApiError(err?.code || 'internal_error', message, res.status, err?.details);
}

// ==================== 设备接口 ====================

/** 查询设备状态（未登记返回 recorded:false，仍是 200） */
export async function deviceStatus(uuid: string): Promise<DeviceStatusData> {
  const status = await request<DeviceStatusData>('/api/v1/device/status', { query: { uuid } });
  rememberDeviceStatus(status);
  return status;
}

/** 采集上报字段（os / 时区 / 语言 / 国家 / 版本） */
export function collectDeviceReportPayload(uuid: string): DeviceReportPayload {
  const osInfo = getOsInfo();
  const payload: DeviceReportPayload = {
    uuid,
    os: osInfo.name || undefined,
    os_version: osInfo.version || undefined,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || undefined,
    language: app.getLocale() || undefined,
    app_version: app.getVersion() || undefined,
  };

  // country 必须是 ISO-3166 alpha-2，不合法就不上报该字段（服务端会 400）
  let country = '';
  try {
    country = app.getLocaleCountryCode() || '';
  } catch {
    country = '';
  }
  if (!/^[A-Za-z]{2}$/.test(country)) {
    const matched = /[-_]([A-Za-z]{2})$/.exec(app.getLocale() || '');
    country = matched?.[1] ?? '';
  }
  if (/^[A-Za-z]{2}$/.test(country)) {
    payload.country = country.toUpperCase();
  }

  return payload;
}

/** 上报本机信息（upsert，顺带完成登记）；响应体就是最新设备状态 */
export async function deviceReport(uuid: string): Promise<DeviceStatusData> {
  const payload = collectDeviceReportPayload(uuid);
  log.info(`[launcher-api] 上报设备 uuid=${uuid} source=${getSmbiosUuid().source} os=${payload.os ?? '-'}`);
  const status = await request<DeviceStatusData>('/api/v1/device/report', { method: 'POST', body: payload });
  rememberDeviceStatus(status);
  return status;
}

/** 设备维度通知（轮询用；启动器仅在启动时查一次） */
export async function deviceNotifications(uuid: string): Promise<LauncherNotification[]> {
  const data = await request<{ notifications?: LauncherNotification[] }>('/api/v1/device/notifications', {
    query: { uuid },
  });
  return data?.notifications ?? [];
}

function normalizeDevice(
  status: DeviceStatusData,
  uuid: string,
  uuidSource: SmbiosUuidSource,
  reported: boolean,
): DeviceCheckResult {
  return {
    uuid,
    uuid_source: uuidSource,
    reported,
    recorded: status.recorded === true,
    blacklisted: status.blacklisted === true,
    blacklist: status.blacklist ?? null,
    bound_user: status.bound_user ?? null,
    notifications: status.notifications ?? [],
    developer_mode: status.developer_mode === true,
    enforced: isEnforced(),
  };
}

/**
 * 设备校验（OOBE / UPVP 的「设备状态查询」步骤）：
 *   未登记 → 先上报（上报即登记）→ 用返回的最新状态判定；
 *   已登记 → 直接判定。
 * 黑名单是**正常数据**（返回 blacklisted:true，不抛错）；网络/鉴权错误才抛。
 */
export async function deviceCheck(): Promise<DeviceCheckResult> {
  const { uuid, source } = getSmbiosUuid();
  if (!uuid) {
    throw new LauncherApiError(
      'device_uuid_unavailable',
      '无法识别本机设备（SMBIOS UUID 与设备指纹均不可用），请联系支持',
    );
  }

  let status = await deviceStatus(uuid);
  let reported = false;
  if (status.recorded !== true) {
    log.info('[launcher-api] 设备未登记，执行一次上报');
    status = await deviceReport(uuid);
    reported = true;
  }
  return normalizeDevice(status, uuid, source, reported);
}

// ==================== 设备心跳（周期上报） ====================

/**
 * 设备心跳间隔：进程存活期间每 2 分钟 POST /device/report 一次。
 *
 * 目的：保持 last_seen_at / report_count 新鲜，让服务端能知道这台机器「活着」，
 * 并可在设备侧下发黑名单、开发者模式等变更（心跳响应就是最新设备状态）。
 * 限流桶（设备四接口 + 版本两接口共用 120/分/IP）下 0.5 次/分钟，完全安全。
 *
 * 失败策略：只记日志（同一错误只记一次，避免断网时刷屏），不弹窗、不影响任何功能。
 */
export const DEVICE_HEARTBEAT_INTERVAL_MS = 2 * 60 * 1000;

/** 最近一次拿到的设备状态（启动检查 / OOBE 校验 / 心跳都会刷新，供调试页展示） */
let latestDeviceStatus: { at: number; status: DeviceStatusData } | null = null;

function rememberDeviceStatus(status: DeviceStatusData): void {
  latestDeviceStatus = { at: Date.now(), status };
}

/** 调试用：最近一次设备状态（心跳或校验） */
export function getLatestDeviceStatus(): { at: number; status: DeviceStatusData } | null {
  return latestDeviceStatus;
}

/** 心跳事件载荷（主进程 → 渲染端，通道 launcher-api:device-updated） */
export interface DeviceHeartbeatEvent {
  /** 本次上报完成的时间戳（ms） */
  at: number;
  /** 服务端返回的最新设备状态 */
  status: DeviceStatusData;
}

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let heartbeatCount = 0;
let lastHeartbeatError = '';

/** 把心跳结果广播给所有渲染窗口（窗口销毁瞬间发送失败直接忽略） */
function broadcastHeartbeat(status: DeviceStatusData): void {
  const payload: DeviceHeartbeatEvent = { at: Date.now(), status };
  for (const w of electron.BrowserWindow.getAllWindows()) {
    if (w.isDestroyed()) continue;
    try {
      w.webContents.send('launcher-api:device-updated', payload);
    } catch {
      // 窗口正在销毁，忽略
    }
  }
}

async function heartbeatOnce(): Promise<void> {
  const { uuid } = getSmbiosUuid();
  if (!uuid) return;
  try {
    const status = await deviceReport(uuid);
    heartbeatCount += 1;
    lastHeartbeatError = '';
    broadcastHeartbeat(status);
  } catch (e) {
    const text = toErrorText(e);
    if (text !== lastHeartbeatError) {
      lastHeartbeatError = text;
      log.warn(
        `[launcher-api] 心跳上报失败（每 ${DEVICE_HEARTBEAT_INTERVAL_MS / 60000} 分钟重试）：${text}`,
      );
    }
  }
}

/**
 * 启动设备心跳（进程级单例）。定时器 unref，不阻止进程退出；
 * 由 main.ts 在 app ready 后调用，退出时 stopDeviceHeartbeat()。
 */
export function startDeviceHeartbeat(): void {
  if (heartbeatTimer) return;
  heartbeatTimer = setInterval(() => {
    void heartbeatOnce();
  }, DEVICE_HEARTBEAT_INTERVAL_MS);
  heartbeatTimer.unref?.();
  log.info(
    `[launcher-api] 设备心跳已启动（每 ${DEVICE_HEARTBEAT_INTERVAL_MS / 60000} 分钟 POST /device/report）`,
  );
}

export function stopDeviceHeartbeat(): void {
  if (!heartbeatTimer) return;
  clearInterval(heartbeatTimer);
  heartbeatTimer = null;
}

/** 心跳运行信息（调试页展示） */
export interface HeartbeatInfo {
  interval_ms: number;
  /** 心跳成功上报累计次数 */
  count: number;
  /** 最近一次成功上报的时间与设备状态 */
  last: DeviceHeartbeatEvent | null;
  running: boolean;
}

export function heartbeatInfo(): HeartbeatInfo {
  return {
    interval_ms: DEVICE_HEARTBEAT_INTERVAL_MS,
    count: heartbeatCount,
    last: latestDeviceStatus ? { at: latestDeviceStatus.at, status: latestDeviceStatus.status } : null,
    running: heartbeatTimer !== null,
  };
}

// ==================== 版本策略 ====================

/** 版本策略查询 + 升级判定 */
export async function versionPolicy(version?: string): Promise<VersionPolicyResult> {
  const current = version?.trim() || app.getVersion();
  const data = await request<Omit<VersionPolicyResult, 'needs_upgrade' | 'upgrade_target' | 'enforced'>>(
    '/api/v1/launcher/version',
    { query: { version: current } },
  );

  const minUpgrade = data.min_upgrade_version ?? null;
  // 复用 updater 的项目版本序（base 数值优先 → 构建号），与更新模块的判定保持一致
  const belowMin = minUpgrade ? compareVersionTags(current, minUpgrade) < 0 : false;
  const needsUpgrade = data.force_upgrade === true || belowMin;
  const upgradeTarget =
    data.resolved_upgrade_target ?? data.upgrade_target_version ?? minUpgrade ?? data.latest_stable ?? null;

  return {
    known: data.known === true,
    version: data.version || current,
    channel: data.channel ?? null,
    is_legacy: data.is_legacy === true,
    activation_blocked: data.activation_blocked === true,
    block_reason: data.block_reason ?? null,
    force_upgrade: data.force_upgrade === true,
    min_upgrade_version: minUpgrade,
    upgrade_target_version: data.upgrade_target_version ?? null,
    resolved_upgrade_target: data.resolved_upgrade_target ?? null,
    latest_stable: data.latest_stable ?? null,
    latest_beta: data.latest_beta ?? null,
    notifications: data.notifications ?? [],
    needs_upgrade: needsUpgrade,
    upgrade_target: needsUpgrade ? upgradeTarget : null,
    enforced: isEnforced(),
  };
}

// ==================== 启动检查 ====================

let startupCache: { at: number; promise: Promise<StartupCheckResult> } | null = null;

/**
 * 启动检查：并行做设备校验与版本策略查询，两者**互不拖累**。
 * 结果缓存 30s，吸收页面刷新/组件重挂导致的重复请求（限流桶是共享的）。
 */
export function startupCheck(force = false): Promise<StartupCheckResult> {
  if (!force && startupCache && Date.now() - startupCache.at < STARTUP_CACHE_MS) {
    return startupCache.promise;
  }
  const promise = runStartupCheck();
  startupCache = { at: Date.now(), promise };
  return promise;
}

async function runStartupCheck(): Promise<StartupCheckResult> {
  const [deviceSettled, policySettled] = await Promise.allSettled([deviceCheck(), versionPolicy()]);

  const device =
    deviceSettled.status === 'fulfilled'
      ? { ok: true, data: deviceSettled.value, error: null }
      : { ok: false, data: null, error: toErrorText(deviceSettled.reason) };

  const policy =
    policySettled.status === 'fulfilled'
      ? { ok: true, data: policySettled.value, error: null }
      : { ok: false, data: null, error: toErrorText(policySettled.reason) };

  let block: StartupBlockKind | null = null;
  if (device.ok && device.data?.blacklisted) {
    block = 'device_blacklisted';
  } else if (policy.ok && policy.data?.activation_blocked) {
    block = 'activation_blocked';
  } else if (policy.ok && policy.data?.needs_upgrade) {
    block = 'force_upgrade';
  }

  const result: StartupCheckResult = {
    device,
    policy,
    allowed: block === null,
    block,
    enforced: isEnforced(),
  };
  log.info(
    `[launcher-api] 启动检查：设备=${device.ok ? (device.data?.blacklisted ? '黑名单' : '正常') : `失败(${device.error})`} ` +
      `版本=${policy.ok ? (policy.data?.activation_blocked ? '禁激活' : policy.data?.needs_upgrade ? '需升级' : '正常') : `失败(${policy.error})`} ` +
      `block=${block ?? 'none'} enforced=${result.enforced}`,
  );
  return result;
}

/** 调试用：清空启动检查缓存 */
export function resetStartupCache(): void {
  startupCache = null;
}
