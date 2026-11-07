/**
 * 公共节点（EasyTier peer）连通性探测。
 *
 * 陶瓦把 `public_nodes` 原样交给 EasyTier：既可以是 `tcp://host:port` / `udp://host:port`
 * 这类直连地址，也可以是 `https://…/node` 这类「取地址」节点（返回纯文本真实地址）。
 * 这里不启动任何进程，只用 DNS / TCP / HTTP 做一次快速可达性判断，
 * 让用户在设置页直接看到「哪个节点能连、哪个连不上、为什么」。
 *
 * 注意：结果只代表「本机现在能否连到这个节点」，不代表房主与加入方最终一定能打洞成功。
 */
import dns from 'node:dns/promises';
import net from 'node:net';
import { createLogger } from './logger';

const log = createLogger('terracotta-nodes');

/** 单个节点的探测结果 */
export interface TerracottaNodeProbe {
  /** 用户填写的原始文本 */
  node: string;
  /** 是否可用（udp 节点只校验 DNS，视为可用但不保证） */
  ok: boolean;
  /** 节点类型：直连地址 / 取地址节点 / 无法识别 */
  kind: 'tcp' | 'udp' | 'https' | 'unknown';
  /** 取地址节点解析出的真实地址（如 `tcp://1.2.3.4:11010`） */
  resolved: string | null;
  /** 面向用户的中文说明 */
  detail: string;
}

const HTTP_TIMEOUT_MS = 8000;
const TCP_TIMEOUT_MS = 6000;
const ADDRESS_RE = /\b(?:tcp|udp|ws|wss):\/\/[^\s"'<>]+/i;

/** 把 `host:port` / `tcp://host:port` 拆成主机与端口 */
function parseEndpoint(raw: string): { kind: 'tcp' | 'udp'; host: string; port: number } | null {
  const trimmed = raw.trim();
  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed);
  const kind: 'tcp' | 'udp' = /^udp:\/\//i.test(trimmed) ? 'udp' : 'tcp';
  const withScheme = hasScheme ? trimmed : `tcp://${trimmed}`;
  try {
    const url = new URL(withScheme);
    const host = url.hostname.replace(/^\[|\]$/g, '');
    const port = Number(url.port || '11010');
    if (!host || !Number.isInteger(port) || port <= 0 || port > 65535) return null;
    return { kind, host, port };
  } catch {
    return null;
  }
}

/** TCP 握手探测（成功 resolve，失败 reject 并带可读原因） */
function probeTcp(host: string, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    const done = (error?: Error) => {
      socket.removeAllListeners();
      socket.destroy();
      if (error) reject(error);
      else resolve();
    };
    socket.setTimeout(TCP_TIMEOUT_MS);
    socket.once('connect', () => done());
    socket.once('timeout', () => done(new Error('连接超时')));
    socket.once('error', (error) => done(error));
  });
}

/** 取地址节点：请求 https 地址，看响应里有没有真实地址 */
async function probeAddressNode(raw: string): Promise<TerracottaNodeProbe> {
  const base: TerracottaNodeProbe = { node: raw, ok: false, kind: 'https', resolved: null, detail: '' };
  try {
    const response = await fetch(raw, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
      headers: { accept: 'text/plain, */*' },
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location') ?? '';
      return {
        ...base,
        detail: `节点返回 ${response.status} 重定向${location ? `（→ ${location}）` : ''}，未给出真实地址`,
      };
    }
    if (!response.ok) {
      return { ...base, detail: `节点返回 HTTP ${response.status}` };
    }

    const text = (await response.text()).slice(0, 4096);
    const match = text.match(ADDRESS_RE);
    if (!match) {
      return { ...base, detail: '响应里没有找到 tcp:// 或 udp:// 形式的地址' };
    }
    return { ...base, ok: true, resolved: match[0], detail: '已返回可用地址' };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ...base, detail: `请求失败：${message}` };
  }
}

/** 单个节点探测 */
export async function probeTerracottaNode(raw: string): Promise<TerracottaNodeProbe> {
  const node = raw.trim();
  if (!node) {
    return { node: raw, ok: false, kind: 'unknown', resolved: null, detail: '节点地址为空' };
  }

  if (/^https?:\/\//i.test(node)) {
    return probeAddressNode(node);
  }

  const endpoint = parseEndpoint(node);
  if (!endpoint) {
    return {
      node,
      ok: false,
      kind: 'unknown',
      resolved: null,
      detail: '无法识别，请填写 host:port 或 tcp://host:port（也可填 https://…/node）',
    };
  }

  const base: TerracottaNodeProbe = {
    node,
    ok: false,
    kind: endpoint.kind,
    resolved: null,
    detail: '',
  };

  // 先看域名能不能解析
  try {
    await dns.lookup(endpoint.host);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ...base, detail: `域名解析失败：${message}` };
  }

  if (endpoint.kind === 'udp') {
    // UDP 无握手，只能确认域名可解析
    return { ...base, ok: true, detail: 'UDP 节点（仅校验域名解析，无法直接探测端口）' };
  }

  try {
    await probeTcp(endpoint.host, endpoint.port);
    return { ...base, ok: true, detail: `TCP ${endpoint.host}:${endpoint.port} 连接成功` };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ...base, detail: `TCP 连接失败：${message}（端口未开放或被防火墙拦截）` };
  }
}

/** 批量探测（去重、保持输入顺序、串行以免同时打满网络） */
export async function probeTerracottaNodes(nodes: string[]): Promise<TerracottaNodeProbe[]> {
  const unique = [...new Set(nodes.map((item) => item.trim()).filter(Boolean))];
  const results: TerracottaNodeProbe[] = [];
  for (const node of unique) {
    const started = Date.now();
    const result = await probeTerracottaNode(node);
    log.info(`probe ${node} -> ok=${result.ok} ${Date.now() - started}ms ${result.detail}`);
    results.push(result);
  }
  return results;
}
