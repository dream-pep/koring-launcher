/**
 * Minecraft Java 版「服务器列表 Ping」探测 —— 用来验证**数据面**是否真的通了。
 *
 * 背景：陶瓦的 `/state` 走到 `guest-ok` 只代表**控制面**成功（联机中心握手完成、
 * 影子端口转发建好），并不保证这条隧道能把游戏流量送到房主的 MC 服务器。
 * 实测就出现过 `guest-ok` 之后本地影子端口 TCP 连接立刻被 RST（10054）的情况。
 *
 * 因此加入成功后，再对陶瓦给的本地直连地址做一次真实的 MC 握手 + status 请求：
 * 能拿到服务器 JSON 响应，才算「数据面可用」。
 */
import net from 'node:net';

export interface McProbeResult {
  ok: boolean;
  /** 失败原因 / 成功时的版本信息，直接给日志用 */
  detail: string;
  /** 服务端版本名（成功时） */
  version?: string;
  players?: { online: number; max: number };
}

/** 探测用的协议版本号（1.20.1），只用于握手，不影响 status 请求本身 */
const HANDSHAKE_PROTOCOL_VERSION = 764;

function writeVarInt(value: number): Buffer {
  const bytes: number[] = [];
  let rest = value;
  do {
    let byte = rest & 0x7f;
    rest >>>= 7;
    if (rest !== 0) byte |= 0x80;
    bytes.push(byte);
  } while (rest !== 0);
  return Buffer.from(bytes);
}

function writeString(value: string): Buffer {
  const body = Buffer.from(value, 'utf8');
  return Buffer.concat([writeVarInt(body.length), body]);
}

/** 解析 varint；数据不完整时返回 null */
function readVarInt(buf: Buffer, offset: number): { value: number; size: number } | null {
  let value = 0;
  let size = 0;
  let byte = 0;
  do {
    if (offset + size >= buf.length) return null;
    byte = buf[offset + size];
    value |= (byte & 0x7f) << (7 * size);
    size += 1;
    if (size > 5) return null;
  } while ((byte & 0x80) !== 0);
  return { value, size };
}

/** 组一个「长度前缀 + 包体」的数据包 */
function frame(payload: Buffer): Buffer {
  return Buffer.concat([writeVarInt(payload.length), payload]);
}

/** 发一个 status 请求包，返回等待响应的 socket 流程 */
function buildStatusRequest(host: string, port: number): Buffer {
  const handshakeBody = Buffer.concat([
    writeVarInt(0x00), // packet id: handshake
    writeVarInt(HANDSHAKE_PROTOCOL_VERSION),
    writeString(host),
    Buffer.from([(port >> 8) & 0xff, port & 0xff]),
    writeVarInt(0x01), // next state: status
  ]);
  const requestBody = writeVarInt(0x00); // packet id: status request
  return Buffer.concat([frame(handshakeBody), frame(requestBody)]);
}

/** 把 `127.0.0.1[:port]` 形式的直连地址拆成 host/port（缺省端口 25565） */
export function parseDirectAddress(address: string): { host: string; port: number } | null {
  const raw = String(address ?? '').trim();
  if (!raw) return null;
  // 兼容 IPv6 的 [::1]:port 写法
  const bracket = /^\[([^\]]+)\](?::(\d+))?$/.exec(raw);
  if (bracket) {
    return { host: bracket[1], port: bracket[2] ? Number(bracket[2]) : 25565 };
  }
  const parts = raw.split(':');
  if (parts.length === 1) return { host: parts[0], port: 25565 };
  if (parts.length === 2) {
    const port = Number(parts[1]);
    if (!Number.isFinite(port) || port <= 0 || port > 65535) return null;
    return { host: parts[0], port };
  }
  return null;
}

/**
 * 对本地直连地址做一次 MC status 探测。
 * 成功 = TCP 连得上 + 握手包发得出去 + 收到合法 JSON 响应（说明整条隧道 + 房主 MC 都活着）。
 */
export async function probeMcServer(
  host: string,
  port: number,
  timeoutMs = 5000,
): Promise<McProbeResult> {
  return new Promise<McProbeResult>((resolve) => {
    let settled = false;
    let buffer = Buffer.alloc(0);
    const socket = new net.Socket();

    const finish = (result: McProbeResult) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };

    const timer = setTimeout(() => {
      finish({ ok: false, detail: `${timeoutMs}ms 内没有收到游戏服务器响应` });
    }, timeoutMs);

    socket.once('connect', () => {
      try {
        socket.write(buildStatusRequest(host, port));
      } catch (e) {
        clearTimeout(timer);
        finish({ ok: false, detail: `发送握手包失败：${e instanceof Error ? e.message : String(e)}` });
      }
    });

    socket.on('data', (chunk: Buffer | string) => {
      const piece = typeof chunk === 'string' ? Buffer.from(chunk, 'utf8') : chunk;
      buffer = Buffer.concat([buffer, piece]);
      const lengthField = readVarInt(buffer, 0);
      if (!lengthField) return;
      if (buffer.length < lengthField.size + lengthField.value) return;
      const body = buffer.subarray(lengthField.size, lengthField.size + lengthField.value);
      const idField = readVarInt(body, 0);
      if (!idField || idField.value !== 0x00) {
        clearTimeout(timer);
        finish({ ok: false, detail: '收到的不是 status 响应包' });
        return;
      }
      const strLen = readVarInt(body, idField.size);
      if (!strLen) {
        clearTimeout(timer);
        finish({ ok: false, detail: 'status 响应包格式不正确' });
        return;
      }
      const start = idField.size + strLen.size;
      const json = body.subarray(start, start + strLen.value).toString('utf8');
      clearTimeout(timer);
      try {
        const parsed = JSON.parse(json) as {
          version?: { name?: string };
          players?: { online?: number; max?: number };
        };
        finish({
          ok: true,
          detail: `游戏服务器响应正常${parsed.version?.name ? `（${parsed.version.name}）` : ''}`,
          version: parsed.version?.name,
          players:
            parsed.players?.online !== undefined && parsed.players?.max !== undefined
              ? { online: parsed.players.online, max: parsed.players.max }
              : undefined,
        });
      } catch {
        finish({ ok: false, detail: 'status 响应不是合法 JSON' });
      }
    });

    socket.once('error', (e) => {
      clearTimeout(timer);
      finish({ ok: false, detail: `连接失败：${e.message}` });
    });

    socket.once('close', () => {
      clearTimeout(timer);
      finish({ ok: false, detail: '连接被关闭（隧道未打通）' });
    });

    socket.connect({ host, port });
  });
}
