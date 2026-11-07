/**
 * 陶瓦联机（Terracotta）协议层 —— 纯 Node 模块。
 *
 * ⚠️ 本文件**禁止 import electron**（也不 import 依赖 electron 的模块，如 ./logger）：
 * 只做类型定义、房间码校验、HTTP 客户端与 `/state` 容错解析，任何地方（纯 Node 脚本 /
 * 单元测试）都能直接 require 复用。进程管理 / 二进制安装等依赖 Electron 的逻辑在
 * `electron/core/terracotta.ts`。
 *
 * 契约来源：plans/terracotta-integration.md §3 / §7.1。上游 API 无鉴权、无 CORS，
 * 只允许主进程访问 127.0.0.1:{port}，渲染进程一律走 IPC。
 */

/** 本地最小日志（不引入 ./logger，保证本文件在纯 Node 下可 require） */
function warn(message: string): void {
  console.warn(`[terracotta/protocol] ${message}`);
}

// ==================== 类型（与 IPC 契约逐字一致） ====================

/** 进程/连接状态 */
export type TcPhase = 'stopped' | 'starting' | 'running' | 'crashed';

/** 上游状态机当前状态 */
export type TcStateName =
  | 'waiting'
  | 'host-scanning'
  | 'host-starting'
  | 'host-ok'
  | 'guest-connecting'
  | 'guest-starting'
  | 'guest-ok'
  | 'exception'
  | 'unknown';

export interface TcProfile {
  machineId: string;
  name: string;
  vendor: string;
  kind: 'HOST' | 'LOCAL' | 'GUEST';
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
}

export interface TcBinaryInfo {
  installed: boolean;
  /** 可执行文件绝对路径；未安装空串 */
  path: string;
  /** 版本号（从 /meta 或目录名推断）；未知空串 */
  version: string;
  /** custom | bundled | dev | downloaded | none */
  source: 'custom' | 'bundled' | 'dev' | 'downloaded' | 'none';
}

export interface TcInstallState {
  active: boolean;
  /** idle | download | extract | verify | done | error */
  stage: 'idle' | 'download' | 'extract' | 'verify' | 'done' | 'error';
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
}

// ==================== 房间码校验 ====================

/**
 * 房间码负载字符集：0-9、A-H、J-N、P-Z（去掉易混淆的 I、O），共 34 个字符。
 * 映射为 0..33 后按**小端序**读成整数（即第 1 个字符是低位），必须能被 7 整除。
 */
const ROOM_CODE_ALPHABET = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const ROOM_CODE_LENGTH = 16;

/** 规范化：去空白、转大写、去掉可选的 `U/` 前缀与分隔符 `-` */
export function normalizeRoomCode(input: string): string {
  if (typeof input !== 'string') return '';
  let value = input.trim().toUpperCase();
  if (value.startsWith('U/')) value = value.slice(2);
  return value.replace(/[\s-]/g, '');
}

/**
 * 本地预校验房间码（最终仍以上游 HTTP 400 为准，本地校验只改善体验）。
 * 合法格式：`U/NNNN-NNNN-SSSS-SSSS`，前缀 `U/` 不参与校验，负载 16 位字符。
 */
export function isValidRoomCode(input: string): boolean {
  const normalized = normalizeRoomCode(input);
  if (normalized.length !== ROOM_CODE_LENGTH) return false;

  let value = 0n;
  let place = 1n; // 34^0 —— 小端序：第一个字符是低位
  for (const ch of normalized) {
    const digit = ROOM_CODE_ALPHABET.indexOf(ch);
    if (digit < 0) return false;
    value += BigInt(digit) * place;
    place *= 34n;
  }
  return value % 7n === 0n;
}

// ==================== /state 容错解析 ====================

/** `/state` 解析结果（字段齐全，缺失给默认值） */
export interface ParsedTcState {
  state: TcStateName;
  index: number;
  room: string;
  url: string;
  difficulty: string;
  profiles: TcProfile[];
  exceptionType: number;
}

const TC_STATE_NAMES: readonly TcStateName[] = [
  'waiting',
  'host-scanning',
  'host-starting',
  'host-ok',
  'guest-connecting',
  'guest-starting',
  'guest-ok',
  'exception',
];

const TC_PROFILE_KINDS: readonly TcProfile['kind'][] = ['HOST', 'LOCAL', 'GUEST'];

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseProfiles(value: unknown): TcProfile[] {
  if (!Array.isArray(value)) return [];
  const result: TcProfile[] = [];
  for (const item of value) {
    const raw = asRecord(item);
    if (!raw) continue;
    const kindRaw = asString(raw.kind).toUpperCase();
    const kind: TcProfile['kind'] = (TC_PROFILE_KINDS as readonly string[]).includes(kindRaw)
      ? (kindRaw as TcProfile['kind'])
      : 'GUEST';
    result.push({
      machineId: asString(raw.machine_id),
      name: asString(raw.name),
      vendor: asString(raw.vendor),
      kind,
    });
  }
  return result;
}

/** 上游 `/state` JSON → 内部快照字段；未知字段忽略、缺失字段给默认值 */
export function parseTcState(payload: unknown): ParsedTcState {
  const raw = asRecord(payload);
  if (!raw) {
    warn('收到非法 /state 响应（不是对象），按 unknown 处理');
    return { state: 'unknown', index: 0, room: '', url: '', difficulty: '', profiles: [], exceptionType: -1 };
  }

  const stateRaw = asString(raw.state);
  const state: TcStateName = (TC_STATE_NAMES as readonly string[]).includes(stateRaw)
    ? (stateRaw as TcStateName)
    : 'unknown';

  return {
    state,
    index: Math.max(0, Math.floor(asNumber(raw.index))),
    room: asString(raw.room),
    url: asString(raw.url),
    difficulty: asString(raw.difficulty),
    profiles: parseProfiles(raw.profiles),
    // 上游 exception 状态的字段是 `type`（{ state:'exception', index, type: 0..5 }）
    exceptionType: state === 'exception' ? Math.floor(asNumber(raw.type)) : -1,
  };
}

/** exception 类型 → 面向用户的中文文案（plans/terracotta-integration.md §3） */
export function describeTcException(type: number): string {
  switch (type) {
    case 0:
      return '无法连接房主或房间已关闭';
    case 1:
      return '与房主的连接已中断';
    case 2:
      return '加入方的 EasyTier 崩溃了';
    case 3:
      return '房主的 EasyTier 崩溃了';
    case 4:
      return '房主的游戏服务器已失联，房间自动关闭';
    case 5:
      return '脚手架协议错误';
    default:
      return '联机出现未知异常';
  }
}

// ==================== HTTP 客户端 ====================

/** 上游接口返回非 2xx / 请求失败时抛出（带 statusCode 便于上层区分 400） */
export class TcHttpError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 0) {
    super(message);
    this.name = 'TcHttpError';
    this.statusCode = statusCode;
  }
}

/** `/meta` 响应（只取契约用到的字段） */
export interface TcMeta {
  version: string;
  easytierVersion: string;
  targetTuple: string;
  targetArch: string;
  targetOs: string;
}

export interface TcScanningParams {
  /** 开房时为空串（房间码由上游生成）；加入房间时必填 */
  room?: string;
  /** 省略则视为空串（上游使用默认显示名） */
  player?: string;
  /** 省略则视为不附加公共节点 */
  publicNodes?: string[];
}

export interface TcHttpClient {
  readonly port: number;
  /** 服务元信息（版本 / EasyTier 版本 / 目标三元组） */
  getMeta(): Promise<TcMeta>;
  /** 状态机快照（已做容错解析） */
  getState(): Promise<ParsedTcState>;
  /** 重置回 waiting（仅 waiting 状态可靠；非 waiting 下调用可能令进程消失，已知缺陷） */
  resetState(): Promise<void>;
  /** 开房（room 传空串，由上游生成） */
  scanning(params: TcScanningParams): Promise<void>;
  /** 加入房间（格式错误或非 waiting → 上游 400） */
  guesting(params: TcScanningParams): Promise<void>;
  /** 优雅退出；连接被重置/失败一律视为成功（服务会先断连再退出） */
  panic(): Promise<void>;
  /** 读取上游 application.log */
  fetchLog(): Promise<string>;
}

/** 各类请求的超时（毫秒） */
const REQUEST_TIMEOUT_MS = 1500;
const PANIC_TIMEOUT_MS = 2000;

function buildQuery(params: TcScanningParams): string {
  const query = new URLSearchParams();
  // room 为空即省略参数，交由上游自动生成邀请码（传空串虽然也走默认分支，但省略更贴合文档）
  const player = params.player ?? '';
  if (params.room) query.set('room', params.room);
  if (player) query.set('player', player);
  // 上游支持重复传参：内置节点之外附加的公共节点直接重复传 public_nodes
  for (const node of params.publicNodes ?? []) {
    if (node) query.append('public_nodes', node);
  }
  return query.toString();
}

/** 创建指向 127.0.0.1:{port} 的内置 HTTP 客户端（仅主进程可用） */
export function createTcHttpClient(port: number): TcHttpClient {
  const base = `http://127.0.0.1:${port}`;

  async function request(pathname: string, timeoutMs: number): Promise<Response> {
    return fetch(`${base}${pathname}`, {
      method: 'GET',
      headers: { Accept: 'application/json, text/plain, */*' },
      signal: AbortSignal.timeout(timeoutMs),
      cache: 'no-store',
    });
  }

  async function expectOk(res: Response, action: string): Promise<void> {
    if (res.ok) {
      // 消费响应体，避免 socket 悬挂
      await res.text().catch(() => '');
      return;
    }
    const detail = await res.text().catch(() => '');
    throw new TcHttpError(
      `${action}失败：HTTP ${res.status}${detail ? `（${detail.slice(0, 200)}）` : ''}`,
      res.status,
    );
  }

  return {
    port,

    async getMeta(): Promise<TcMeta> {
      const res = await request('/meta', REQUEST_TIMEOUT_MS);
      if (!res.ok) throw new TcHttpError(`获取服务信息失败：HTTP ${res.status}`, res.status);
      const raw = asRecord(await res.json().catch(() => null));
      return {
        version: asString(raw?.version),
        easytierVersion: asString(raw?.easytier_version),
        targetTuple: asString(raw?.target_tuple),
        targetArch: asString(raw?.target_arch),
        targetOs: asString(raw?.target_os),
      };
    },

    async getState(): Promise<ParsedTcState> {
      const res = await request('/state', REQUEST_TIMEOUT_MS);
      if (!res.ok) throw new TcHttpError(`获取联机状态失败：HTTP ${res.status}`, res.status);
      return parseTcState(await res.json().catch(() => null));
    },

    async resetState(): Promise<void> {
      const res = await request('/state/ide', REQUEST_TIMEOUT_MS);
      await expectOk(res, '重置状态');
    },

    async scanning(params: TcScanningParams): Promise<void> {
      const res = await request(`/state/scanning?${buildQuery(params)}`, REQUEST_TIMEOUT_MS);
      await expectOk(res, '创建房间');
    },

    async guesting(params: TcScanningParams): Promise<void> {
      const res = await request(`/state/guesting?${buildQuery(params)}`, REQUEST_TIMEOUT_MS);
      if (res.status === 400) {
        await res.text().catch(() => '');
        throw new TcHttpError('房间码无效，或当前状态不允许加入房间', 400);
      }
      await expectOk(res, '加入房间');
    },

    async panic(): Promise<void> {
      try {
        const res = await request('/panic?peaceful=true', PANIC_TIMEOUT_MS);
        await res.text().catch(() => '');
      } catch {
        // 实测服务收到 panic 后会先断开连接再退出：ECONNRESET / 请求失败都属于预期
      }
    },

    async fetchLog(): Promise<string> {
      const res = await request('/log?fetch=true', REQUEST_TIMEOUT_MS);
      if (!res.ok) throw new TcHttpError(`获取日志失败：HTTP ${res.status}`, res.status);
      const text = await res.text();
      // 上游可能直接返回纯文本，也可能返回 JSON 包装；两种都兼容
      const trimmed = text.trim();
      if (trimmed.startsWith('{')) {
        try {
          const raw = asRecord(JSON.parse(trimmed));
          if (raw) {
            for (const key of ['log', 'content', 'data']) {
              if (typeof raw[key] === 'string') return raw[key] as string;
            }
          }
        } catch {
          // 不是合法 JSON：按纯文本返回
        }
      }
      return text;
    },
  };
}
