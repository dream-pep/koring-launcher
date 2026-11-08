import { ipcInvoke, onIpcEvent } from "@/api/ipc";

/**
 * 陶瓦联机（Terracotta）渲染端 API。
 *
 * 契约见 plans/terracotta-integration.md 第 7 节：
 * - 渲染进程绝不直接请求 127.0.0.1:{port}，所有请求都经主进程 IPC。
 * - 通道名、类型字段与文档逐字一致；主进程统一返回 { success, data, error }，
 *   这里经 ipcInvoke 解包（失败时抛出可读中文错误）。
 */

// ---------- 7.1 类型 ----------

export type TcPhase = "stopped" | "starting" | "running" | "crashed";

export type TcStateName =
  | "waiting"
  | "host-scanning"
  | "host-starting"
  | "host-ok"
  | "guest-connecting"
  | "guest-starting"
  | "guest-ok"
  | "exception"
  | "unknown";

export interface TcProfile {
  machineId: string;
  name: string;
  vendor: string;
  kind: "HOST" | "LOCAL" | "GUEST";
}

export interface TcSnapshot {
  /** 进程/连接状态 */
  phase: TcPhase;
  /** 上游状态机当前状态 */
  state: TcStateName;
  /** 上游单调 index（丢弃未增长响应） */
  index: number;
  /** 房间码；无则空串 */
  room: string;
  /** 加入方直连地址；无则空串 */
  url: string;
  /** UNKNOWN/EASIEST/SIMPLE/MEDIUM/TOUGH；无则空串 */
  difficulty: string;
  /** 成员列表 */
  profiles: TcProfile[];
  /** 面向用户的错误文案；无则空串 */
  error: string;
  /** exception 类型；无则 -1 */
  exceptionType: number;
  /** 最近一次 /state 往返耗时（毫秒）；未知 0 */
  latencyMs: number;
}

export interface TcBinaryInfo {
  installed: boolean;
  /** 可执行文件绝对路径；未安装空串 */
  path: string;
  /** 版本号（从 /meta 或目录名推断）；未知空串 */
  version: string;
  /** custom | bundled | dev | downloaded | none */
  source: "custom" | "bundled" | "dev" | "downloaded" | "none";
}

export interface TcInstallState {
  active: boolean;
  /** idle | download | extract | verify | done | error */
  stage: "idle" | "download" | "extract" | "verify" | "done" | "error";
  percent: number;
  transferred: number;
  total: number;
  message: string;
}

export interface TerracottaStatus {
  binary: TcBinaryInfo;
  phase: TcPhase;
  /** 当前端口；未知 0 */
  port: number;
  meta: { version: string; easytierVersion: string; targetTuple: string } | null;
  snapshot: TcSnapshot;
  install: TcInstallState;
  /** 加入房间时正在尝试的公共节点方案（1 起）；不在重试流程中为 null */
  joinAttempt: { current: number; total: number } | null;
  /** 数据面（真实隧道）状态：guest-ok 后对本地直连地址做 MC 握手验证 */
  tunnel: TcTunnelStatus;
}

/** 数据面探测状态 */
export interface TcTunnelStatus {
  state: "unknown" | "checking" | "ok" | "failed";
  detail: string;
}

/** 公共节点连通性检测结果（主进程 DNS / TCP / HTTPS 探测） */
export interface TerracottaNodeProbe {
  node: string;
  ok: boolean;
  kind: "tcp" | "udp" | "https" | "unknown";
  /** 取地址节点解析出的真实地址 */
  resolved: string | null;
  detail: string;
}

/** 渲染端首次渲染用的空状态（真实状态由 terracotta:status 拉取） */
export const EMPTY_TERRACOTTA_STATUS: TerracottaStatus = {
  binary: { installed: false, path: "", version: "", source: "none" },
  phase: "stopped",
  port: 0,
  meta: null,
  snapshot: {
    phase: "stopped",
    state: "unknown",
    index: 0,
    room: "",
    url: "",
    difficulty: "",
    profiles: [],
    error: "",
    exceptionType: -1,
    latencyMs: 0,
  },
  install: { active: false, stage: "idle", percent: 0, transferred: 0, total: 0, message: "" },
  joinAttempt: null,
  tunnel: { state: "unknown", detail: "" },
};

// ---------- 7.2 通道调用 ----------

type ElectronBridge = NonNullable<typeof window.electronAPI>;

/**
 * 主进程统一返回 { success, data, error }；preload 专用方法把原始结果透传回来，
 * 这里做统一解包（与 ipcInvoke 行为一致）。若 preload 尚未提供专用方法，
 * 回退到通用 `invoke` + 契约通道名，保证渲染端可独立工作。
 */
function unwrap<T>(result: unknown): T {
  if (result && typeof result === "object" && "success" in (result as Record<string, unknown>)) {
    const envelope = result as { success: boolean; data?: T; error?: string };
    if (!envelope.success) throw new Error(envelope.error || "Request failed");
    return envelope.data as T;
  }
  return result as T;
}

async function call<T>(method: keyof ElectronBridge, channel: string, args: unknown[] = []): Promise<T> {
  const bridge = window.electronAPI as unknown as Record<string, unknown> | undefined;
  const fn = bridge?.[method as string];
  if (typeof fn === "function") {
    const invoke = fn as (...params: unknown[]) => Promise<unknown>;
    return unwrap<T>(await invoke(...args));
  }
  return ipcInvoke<T>(channel, args.length > 0 ? args[0] : undefined);
}

export async function getTerracottaStatus(): Promise<TerracottaStatus> {
  return call<TerracottaStatus>("terracottaStatus", "terracotta:status");
}

export async function installTerracotta(force = false): Promise<TerracottaStatus> {
  return call<TerracottaStatus>("terracottaInstall", "terracotta:install", [{ force }]);
}

export async function startTerracotta(player?: string): Promise<TerracottaStatus> {
  return call<TerracottaStatus>("terracottaStart", "terracotta:start", [player ? { player } : {}]);
}

export async function stopTerracotta(): Promise<TerracottaStatus> {
  return call<TerracottaStatus>("terracottaStop", "terracotta:stop");
}

export async function hostTerracotta(
  player?: string,
  publicNodes?: string[],
  room?: string,
): Promise<TerracottaStatus> {
  const payload: { player?: string; publicNodes?: string[]; room?: string } = {};
  if (player) payload.player = player;
  if (publicNodes && publicNodes.length > 0) payload.publicNodes = publicNodes;
  if (room) payload.room = room;
  return call<TerracottaStatus>("terracottaHost", "terracotta:host", [payload]);
}

export async function guestTerracotta(
  room: string,
  player?: string,
  publicNodes?: string[],
): Promise<TerracottaStatus> {
  const payload: { room: string; player?: string; publicNodes?: string[] } = { room };
  if (player) payload.player = player;
  if (publicNodes && publicNodes.length > 0) payload.publicNodes = publicNodes;
  return call<TerracottaStatus>("terracottaGuest", "terracotta:guest", [payload]);
}

/** 取消/关闭/返回：主进程调用上游 /state/ide 重置回 waiting */
export async function resetTerracotta(): Promise<TerracottaStatus> {
  return call<TerracottaStatus>("terracottaReset", "terracotta:reset");
}

export async function fetchTerracottaLog(): Promise<string> {
  const data = await call<{ content?: string }>("terracottaFetchLog", "terracotta:fetch-log");
  return data?.content ?? "";
}

export async function openTerracottaDir(): Promise<string> {
  const data = await call<{ path?: string }>("terracottaOpenDir", "terracotta:open-dir");
  return data?.path ?? "";
}

export async function pickTerracottaBinary(): Promise<string> {
  const data = await call<{ path?: string }>("terracottaPickBinary", "terracotta:pick-binary");
  return data?.path ?? "";
}

export async function clearTerracottaBinary(): Promise<TerracottaStatus> {
  return call<TerracottaStatus>("terracottaClearBinary", "terracotta:clear-binary");
}

/**
 * 公共节点连通性检测：主进程只做 DNS / TCP / HTTPS 探测，不启动陶瓦进程。
 * 传空则检测配置里已保存的节点。
 */
export async function checkTerracottaNodes(nodes?: string[]): Promise<TerracottaNodeProbe[]> {
  // preload 专用方法的签名是 (nodes?: string[])；回退通道则直接传数组/空对象
  const data = await call<{ nodes?: TerracottaNodeProbe[] }>(
    "terracottaCheckNodes",
    "terracotta:check-nodes",
    nodes && nodes.length > 0 ? [nodes] : [],
  );
  return data?.nodes ?? [];
}

// ---------- 7.3 事件 ----------

export function onTerracottaStatus(callback: (status: TerracottaStatus) => void): () => void {
  const bridge = window.electronAPI;
  if (typeof bridge?.onTerracottaStatus === "function") {
    return bridge.onTerracottaStatus((data) => callback(data as TerracottaStatus));
  }
  return onIpcEvent<TerracottaStatus>("terracotta:status", callback);
}

export function onTerracottaInstallProgress(callback: (progress: TcInstallState) => void): () => void {
  const bridge = window.electronAPI;
  if (typeof bridge?.onTerracottaInstallProgress === "function") {
    return bridge.onTerracottaInstallProgress((data) => callback(data as TcInstallState));
  }
  return onIpcEvent<TcInstallState>("terracotta:install-progress", callback);
}

// ---------- 房间码 ----------

/** 上游文档站（AGPL 例外条款要求 UI 必须给出的上游链接） */
export const TERRACOTTA_URL = "https://burningtnt.github.io/Terracotta/";

/**
 * 内置公共节点（与主进程 `electron/config.ts` 的 `TERRACOTTA_DEFAULT_PUBLIC_NODES` 保持一致）。
 *
 * **启动联机服务时始终启用**，排在上游内置节点的最前面，不写进用户配置、也没有「填入」入口；
 * 设置页只把它们作为只读信息展示，用户可以额外追加自己的节点。
 *
 * 上游内置的 `public.easytier.top` / `public2.easytier.cn` 已失效，zkitfly 两个节点又会按
 * 地区 / HTTP 版本返回不同内容，所以额外预置自建共享节点（只做打洞撮合，不转发流量）。
 */
export const TERRACOTTA_DEFAULT_PUBLIC_NODES: string[] = [
  "tcp://3.24.48.198:11010",
  "udp://3.24.48.198:11010",
];

/** 房间码负载长度 */
export const ROOM_CODE_LENGTH = 16;

/** 34 字符集：0-9、A-H、J-N、P-Z（去掉易混淆的 I / O） */
export const ROOM_CODE_CHARSET = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ";

const ROOM_CODE_PREFIX = "U/";

/** 网页邀请落地页（只承载 /room，其余路径 308 回 account.koring.space） */
export const ROOM_INVITE_BASE = "https://link.koring.space/room";

/**
 * 生成分享用的网页邀请链接。
 * 好友点开后网页会引导唤起 `koring://room-join?code=…` 由启动器直接进房；
 * 房间码里的 `/` 保持原样（其余字符仍然编码）。
 */
export function terracottaInviteLink(code: string): string {
  const value = (code ?? "").trim();
  if (!value) return "";
  const full = value.startsWith(ROOM_CODE_PREFIX) ? value : `${ROOM_CODE_PREFIX}${value}`;
  return `${ROOM_INVITE_BASE}?code=${encodeURIComponent(full).replace(/%2F/g, "/")}`;
}

/**
 * 输入框格式化：自动转大写、每 4 位插入 `-`、保留可选的 `U/` 前缀。
 * 只过滤空白与已存在的 `-`，其余字符保留以便校验时给出「无效字符」提示。
 */
export function formatRoomCodeInput(raw: string): string {
  const upper = raw.toUpperCase().trim();
  let prefix = "";
  let payload = upper;
  if (upper.startsWith(ROOM_CODE_PREFIX)) {
    prefix = ROOM_CODE_PREFIX;
    payload = upper.slice(ROOM_CODE_PREFIX.length);
  }
  const chars = payload.replace(/[\s-]/g, "").slice(0, ROOM_CODE_LENGTH);
  const groups = chars.match(/.{1,4}/g) ?? [];
  return prefix + groups.join("-");
}

/** 去掉 `U/` 前缀与 `-`，返回 16 位负载（可能包含非法字符，供校验） */
export function roomCodePayload(code: string): string {
  const upper = code.toUpperCase().trim();
  const body = upper.startsWith(ROOM_CODE_PREFIX) ? upper.slice(ROOM_CODE_PREFIX.length) : upper;
  return body.replace(/[\s-]/g, "");
}

/** 34 进制小端序 → BigInt */
export function roomCodeToBigInt(payload: string): bigint {
  let value = 0n;
  let place = 1n;
  for (const ch of payload) {
    const digit = ROOM_CODE_CHARSET.indexOf(ch);
    if (digit < 0) return -1n;
    value += BigInt(digit) * place;
    place *= 34n;
  }
  return value;
}

/**
 * 本地格式校验（契约 3 节）：
 * 34 字符集 + 16 位负载 + 小端序读数必须被 7 整除。
 * 通过返回 null，否则返回可读中文错误。最终仍以上游 HTTP 400 为准。
 */
export function validateRoomCode(code: string): string | null {
  const payload = roomCodePayload(code);
  if (!payload) return "请输入房间码";
  const invalid = [...payload].find((ch) => !ROOM_CODE_CHARSET.includes(ch));
  if (invalid) return `房间码包含无效字符「${invalid}」`;
  if (payload.length < ROOM_CODE_LENGTH) {
    return `房间码不完整，还需 ${ROOM_CODE_LENGTH - payload.length} 位`;
  }
  if (payload.length > ROOM_CODE_LENGTH) return "房间码超过 16 位，请检查是否输入正确";
  const value = roomCodeToBigInt(payload);
  if (value < 0n || value % 7n !== 0n) return "房间码校验失败，请检查是否输入正确";
  return null;
}
