/**
 * 陶瓦联机（Terracotta）服务 —— 主进程单例。
 *
 * 职责：
 * - 定位二进制（自定义 → 打包内置 → dev 仓库 build/terracotta → userData 运行时下载）
 * - 运行时下载安装（GitHub Release 资产 tar.gz → zlib.gunzipSync + 手写 tar 解包）
 * - `terracotta --hmcl <portFile>` 启动、端口文件发现、500ms `/state` 轮询、状态广播
 * - 开房 / 加入 / 重置 / 退出等控制
 *
 * ⚠️ 关键事实（Windows）：`--hmcl` 进程只是引导进程，写完端口文件后就会退出；
 * 真正的工作进程是 detached 子进程。因此**绝不能**用引导进程的 exit 事件判定崩溃，
 * 存活判定只依赖 `/state` 轮询连续 5 次失败（见 plans/terracotta-integration.md §8）。
 *
 * ⚠️ 渲染进程不能直接访问 127.0.0.1（无 CORS、且不应暴露端口），所有 HTTP 都在
 * 本文件（主进程）完成，渲染端只通过 IPC 收发 `TerracottaStatus`。
 */
import electron from 'electron';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import zlib from 'node:zlib';
import { getConfig, updateConfig } from '../config';
import { readAuthStore } from '../auth';
import { readKoringAuth } from './koring-auth';
import { reportRoomClose, reportRoomOpen } from './launcher-api';
import { createLogger } from './logger';
import {
  createTcHttpClient,
  describeTcException,
  isValidRoomCode,
  type ParsedTcState,
  type TcBinaryInfo,
  type TcInstallState,
  type TcMeta,
  type TcPhase,
  type TcProfile,
  type TcSnapshot,
  type TcStateName,
  type TerracottaStatus,
} from './terracotta-protocol';

const { app } = electron;

const log = createLogger('core/terracotta');

// ==================== 常量 ====================

/** 跟随的上游版本（可用环境变量 TERRACOTTA_VERSION 覆盖，方便灰度/测试） */
const DEFAULT_TERRACOTTA_VERSION = 'v0.4.2';
/** 上游状态轮询间隔 */
const POLL_INTERVAL_MS = 500;
/** 连续轮询失败多少次视为服务已退出 */
const MAX_POLL_FAILURES = 5;
/** 启动超时（端口文件最长等待） */
const START_TIMEOUT_MS = 20_000;
/** 端口文件轮询间隔 */
const PORT_FILE_POLL_MS = 100;
/** 安装进度事件节流 */
const INSTALL_PROGRESS_THROTTLE_MS = 100;
/** 安装进度变化时状态事件的节流（比进度事件稀疏） */
const STATUS_DURING_INSTALL_THROTTLE_MS = 500;
/** 网页房间上报失败后的重试间隔 */
const ROOM_REPORT_RETRY_MS = 15_000;
/** GitHub Release 接口超时 */
const RELEASE_API_TIMEOUT_MS = 15_000;
/** 二进制下载 socket 空闲超时 */
const DOWNLOAD_TIMEOUT_MS = 30_000;
/** 可执行文件最小合理大小（校验用，防止下到 HTML 错误页/空文件） */
const MIN_BINARY_SIZE = 1024 * 1024;
const USER_AGENT = 'koring-launcher-terracotta';
const RELEASE_API_BASE = 'https://api.github.com/repos/burningtnt/Terracotta/releases/tags/';

/** 平台/架构 → 上游资产名中的 target 段（plans/terracotta-integration.md §5） */
const PLATFORM_ASSET_SUFFIX: Record<string, string> = {
  'win32-x64': 'windows-x86_64',
  'win32-arm64': 'windows-arm64',
  'darwin-x64': 'macos-x86_64',
  'darwin-arm64': 'macos-arm64',
  'linux-x64': 'linux-x86_64',
  'linux-arm64': 'linux-arm64',
  'linux-loong64': 'linux-loongarch64',
  'linux-riscv64': 'linux-riscv64',
};

/** 端口文件里最多允许的端口号 */
const MAX_PORT = 65535;

// ==================== 小工具 ====================

/** 可执行文件名（Windows 带 .exe；其余平台不带） */
function executableName(): string {
  return process.platform === 'win32' ? 'terracotta.exe' : 'terracotta';
}

/** 当前平台的 release 资产 target 段 */
function platformAssetSuffix(): string | null {
  return PLATFORM_ASSET_SUFFIX[`${process.platform}-${process.arch}`] ?? null;
}

/** 规范化版本 tag：允许环境变量写成 `0.4.2` 或 `v0.4.2`，统一补 `v` */
function resolveVersionTag(): string {
  const fromEnv = (process.env.TERRACOTTA_VERSION ?? '').trim();
  const value = fromEnv || DEFAULT_TERRACOTTA_VERSION;
  return value.startsWith('v') ? value : `v${value}`;
}

/** 版本号去掉前缀 v，UI 展示用 */
function normalizeVersion(value: string): string {
  return value.trim().replace(/^[vV]/, '');
}

/** 房间码补全 `U/` 前缀（上游 /state 的 room 不带前缀，网页链接需要完整码） */
function fullRoomCode(room: string): string {
  const value = (room ?? '').trim();
  if (!value) return '';
  return value.startsWith('U/') ? value : `U/${value}`;
}

function emptyInstallState(): TcInstallState {
  return { active: false, stage: 'idle', percent: 0, transferred: 0, total: 0, message: '' };
}

function emptySnapshot(): TcSnapshot {
  return {
    phase: 'stopped',
    state: 'waiting',
    index: 0,
    room: '',
    url: '',
    difficulty: '',
    profiles: [],
    error: '',
    exceptionType: -1,
    latencyMs: 0,
  };
}

function safeStat(target: string): fs.Stats | null {
  try {
    return fs.statSync(target);
  } catch {
    return null;
  }
}

/** 是否是「像样」的可执行文件：存在、是普通文件且大于 1MB */
function isUsableBinary(target: string): boolean {
  const stat = safeStat(target);
  return !!stat && stat.isFile() && stat.size > MIN_BINARY_SIZE;
}

/**
 * 在目录里找可执行文件。
 * 优先精确名 `terracotta(.exe)`；找不到再兜底匹配上游资产里的带版本文件名
 * （如 `terracotta-0.4.2-windows-x86_64.exe`，我们**不重命名**二进制目录里的任何文件）。
 */
function findExecutableIn(dir: string): string {
  const exact = path.join(dir, executableName());
  if (isUsableBinary(exact)) return exact;

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return '';
  }
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const name = entry.name;
    if (!/^terracotta/i.test(name)) continue;
    if (process.platform === 'win32' && !name.toLowerCase().endsWith('.exe')) continue;
    const full = path.join(dir, name);
    if (isUsableBinary(full)) return full;
  }
  return '';
}

/** 从可执行文件名 / 目录名推断版本号（如 terracotta-0.4.2-windows-x86_64.exe） */
function inferVersionFromPath(target: string): string {
  for (const candidate of [path.basename(target), path.basename(path.dirname(target))]) {
    const matched = /(\d+\.\d+\.\d+(?:[-.][0-9A-Za-z]+)*)/.exec(candidate);
    if (matched) return matched[1];
  }
  return '';
}

/**
 * 本机已登录的 Koring 账号用户名（陶瓦联机显示名的唯一来源）。
 * 优先读 koring-auth.json，回退配置文件里同步保存的 koringUser；未登录返回空串。
 */
function readKoringUsername(): string {
  try {
    const stored = readKoringAuth();
    const name = stored?.user?.username?.trim();
    if (name) return name;
  } catch {
    /* ignore */
  }
  try {
    const cached = (getConfig() as unknown as { koringUser?: { username?: string } }).koringUser;
    return cached?.username?.trim() ?? '';
  } catch {
    return '';
  }
}

// ==================== 下载 / 解包 ====================

interface ReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

interface ResolvedReleaseAsset {
  name: string;
  url: string;
  size: number;
}

/**
 * 从 GitHub Release 里挑出当前平台的 `terracotta-{version}-{target}-pkg.tar.gz`。
 * 固定 tag 直查（避免拉全量 release 列表）；网络失败会直接报错给安装状态。
 */
async function resolveReleaseAsset(versionTag: string, targetSuffix: string): Promise<ResolvedReleaseAsset> {
  const url = `${RELEASE_API_BASE}${encodeURIComponent(versionTag)}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/vnd.github+json' },
    signal: AbortSignal.timeout(RELEASE_API_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`获取陶瓦联机版本信息失败：HTTP ${res.status}`);
  }
  const data = (await res.json().catch(() => null)) as { assets?: ReleaseAsset[] } | null;
  const assets = Array.isArray(data?.assets) ? data.assets : [];
  const usable = assets.filter(
    (asset) => typeof asset.name === 'string' && typeof asset.browser_download_url === 'string',
  );
  const asset =
    usable.find((a) => a.name.endsWith(`-${targetSuffix}-pkg.tar.gz`)) ??
    usable.find((a) => a.name.includes(`-${targetSuffix}`) && a.name.endsWith('pkg.tar.gz')) ??
    usable.find((a) => a.name.includes(targetSuffix));
  if (!asset) {
    throw new Error(`未找到当前平台的陶瓦联机安装包（${targetSuffix}）`);
  }
  log.info(`[terracotta] 选中资产：${asset.name}`);
  return { name: asset.name, url: asset.browser_download_url, size: Number(asset.size) || 0 };
}

/** 下载文件（跟随最多 5 次重定向，按 content-length 回报进度） */
function downloadWithProgress(
  url: string,
  dest: string,
  expectedSize: number,
  onProgress: (transferred: number, total: number) => void,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const request = (target: string, redirects: number): void => {
      const lib = target.startsWith('https:') ? https : http;
      const req = lib.get(
        target,
        { headers: { 'User-Agent': USER_AGENT, Accept: '*/*' } },
        (res) => {
          const status = res.statusCode ?? 0;
          if ([301, 302, 303, 307, 308].includes(status) && res.headers.location) {
            res.resume();
            if (redirects >= 5) {
              reject(new Error('下载重定向次数过多'));
              return;
            }
            request(new URL(res.headers.location, target).toString(), redirects + 1);
            return;
          }
          if (status !== 200) {
            res.resume();
            reject(new Error(`下载失败：HTTP ${status}`));
            return;
          }
          const total = Number(res.headers['content-length'] ?? expectedSize) || expectedSize;
          let transferred = 0;
          const stream = fs.createWriteStream(dest);
          res.on('data', (chunk: Buffer) => {
            transferred += chunk.length;
            onProgress(transferred, total);
          });
          res.on('error', reject);
          stream.on('error', reject);
          stream.on('finish', () => {
            stream.close(() => {
              if (expectedSize > 0 && transferred !== expectedSize) {
                reject(new Error(`安装包大小不符（${transferred}/${expectedSize}）`));
                return;
              }
              resolve();
            });
          });
          res.pipe(stream);
        },
      );
      req.on('error', reject);
      req.setTimeout(DOWNLOAD_TIMEOUT_MS, () => {
        req.destroy(new Error('下载超时'));
      });
    };
    request(url, 0);
  });
}

/** 读取 tar 头里的 C 字符串字段（NUL 结尾） */
function readTarString(buffer: Buffer, start: number, length: number): string {
  const slice = buffer.subarray(start, start + length);
  const nul = slice.indexOf(0);
  return slice.subarray(0, nul === -1 ? slice.length : nul).toString('utf8');
}

/** 读取 tar 头里的八进制（兼容 GNU base-256）数值字段 */
function readTarNumber(buffer: Buffer, start: number, length: number): number {
  const slice = buffer.subarray(start, start + length);
  if (slice.length === 0) return 0;
  // GNU base-256：首个字节最高位为 1，其余字节为大端整数
  if (slice[0] & 0x80) {
    let value = 0;
    for (let i = 1; i < slice.length; i += 1) value = value * 256 + slice[i];
    return value;
  }
  const text = readTarString(buffer, start, length).trim();
  if (!text) return 0;
  const parsed = Number.parseInt(text, 8);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** 把单个 tar 条目安全落盘（拒绝 `..` 与绝对路径） */
function writeTarEntry(
  archive: Buffer,
  dataStart: number,
  size: number,
  destDir: string,
  entryName: string,
): void {
  const relative = entryName.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!relative) return;
  if (relative.split('/').some((part) => part === '..')) {
    log.warn(`[terracotta] 跳过非法 tar 路径（含 ..）：${entryName}`);
    return;
  }
  const target = path.resolve(destDir, relative);
  const rel = path.relative(destDir, target);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
    log.warn(`[terracotta] 跳过越界 tar 路径：${entryName}`);
    return;
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, archive.subarray(dataStart, dataStart + size));
}

/**
 * 解包 tar.gz（手写 tar 解析，不引入任何依赖）。
 * 只落普通文件；目录项 / pax / 符号链接跳过；支持 ustar prefix 与 GNU 长文件名（L）。
 */
function extractTarGz(archivePath: string, destDir: string): void {
  const archive = zlib.gunzipSync(fs.readFileSync(archivePath));
  const BLOCK = 512;
  let offset = 0;
  let pendingLongName: string | null = null;
  let fileCount = 0;

  while (offset + BLOCK <= archive.length) {
    const header = archive.subarray(offset, offset + BLOCK);
    if (header.every((byte) => byte === 0)) break; // 结束标记（两个全零块，读到一个即可）
    const rawName = readTarString(header, 0, 100);
    const rawPrefix = readTarString(header, 345, 155);
    const size = readTarNumber(header, 124, 12);
    const typeFlag = header[156] === 0 ? '0' : String.fromCharCode(header[156]);
    const dataStart = offset + BLOCK;
    const dataEnd = dataStart + size;
    if (dataEnd > archive.length) throw new Error('安装包损坏（tar 数据越界）');

    if (typeFlag === 'L') {
      // GNU 长文件名：内容就是下一个条目的完整路径
      pendingLongName = archive.subarray(dataStart, dataEnd).toString('utf8').replace(/\0+$/, '');
    } else if (typeFlag === 'x' || typeFlag === 'g') {
      // pax 扩展头：文件名不会超长，直接跳过
    } else if (typeFlag === '5') {
      // 目录项：写文件时会按需 mkdir
      pendingLongName = null;
    } else if (typeFlag === '0' || typeFlag === '7') {
      const entryName = pendingLongName ?? (rawPrefix ? `${rawPrefix}/${rawName}` : rawName);
      pendingLongName = null;
      writeTarEntry(archive, dataStart, size, destDir, entryName);
      fileCount += 1;
    } else {
      // 符号链接 / 硬链接等：上游安装包用不到，忽略
      pendingLongName = null;
    }
    offset = dataStart + Math.ceil(size / BLOCK) * BLOCK;
  }

  if (fileCount === 0) throw new Error('安装包内没有任何文件');
}

// ==================== 服务 ====================

/** 广播函数：由 IPC handler 注册时注入（把事件发给所有窗口） */
export type TcBroadcaster = (channel: string, payload: unknown) => void;

/**
 * 本工程里 @types/node 的 `node:events` 解析异常（Node10 解析把 `node:` 当成绝对路径），
 * 导致 `ChildProcess` 丢掉了从 EventEmitter 继承的成员。这里用最小接口补齐实际用到的
 * 事件重载（运行时对象当然有 on），不做 `as any`。
 */
interface TerracottaChildProcess {
  on(event: 'error', listener: (error: Error) => void): void;
  on(event: 'exit', listener: (code: number | null) => void): void;
}

export interface TcStartPayload {
  player?: string;
}

export interface TcHostPayload {
  player?: string;
  publicNodes?: string[];
}

export interface TcGuestPayload {
  room: string;
  player?: string;
  publicNodes?: string[];
}

/**
 * 陶瓦联机服务（单例，见文件末尾 `terracottaService`）。
 * 所有对外方法都不抛出「预期的业务错误」之外的异常；IPC handler 统一 try/catch。
 */
export class TerracottaService {
  private broadcaster: TcBroadcaster | null = null;

  private phase: TcPhase = 'stopped';
  private port = 0;
  private meta: TcMeta | null = null;

  // 最近一次 /state 快照字段（与 TerracottaStatus.snapshot 对应）
  private state: TcStateName = 'waiting';
  private index = 0;
  private room = '';
  private url = '';
  private difficulty = '';
  private profiles: TcProfile[] = [];
  private exceptionType = -1;
  private error = '';
  /** 最近一次 /state 往返耗时（毫秒），供 UI 折线图展示服务响应 */
  private latencyMs = 0;

  /** 已上报到网页端的房间号（带 U/ 前缀），用于离开 host-ok 时上报关闭 */
  private reportedRoom = '';

  /** 正在尝试上报 open 的房间号（成功前不等于 reportedRoom） */
  private openReportRoom = '';
  /** open 上报失败后的重试时间点（服务端故障自愈用） */
  private openReportBlockedUntil = 0;
  /** open 失败只 warn 一次，避免 500 每 15s 刷屏 */
  private openReportWarned = false;

  /** 房间上报串行队列（open 一定先于 close 发出） */
  private roomReportQueue: Promise<void> = Promise.resolve();

  private child: TerracottaChildProcess | null = null;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private pollFailures = 0;
  /** 生命周期代号：stop() 自增，用于让进行中的 start 流程及时收手 */
  private lifecycle = 0;
  /** 引导进程 spawn 失败时记录的错误（等待端口文件期间据此提前失败） */
  private processError: string | null = null;

  private startPromise: Promise<TerracottaStatus> | null = null;
  private stopPromise: Promise<TerracottaStatus> | null = null;

  private installState: TcInstallState = emptyInstallState();
  private installPromise: Promise<void> | null = null;
  private lastInstallEmitAt = 0;

  private lastStatusJson = '';
  private lastStatusAt = 0;

  /** 由 IPC handler 在注册时注入广播函数 */
  setBroadcaster(broadcaster: TcBroadcaster | null): void {
    this.broadcaster = broadcaster;
  }

  // ---------- 状态查询 ----------

  getStatus(): TerracottaStatus {
    return {
      binary: this.getBinaryInfo(),
      phase: this.phase,
      port: this.port,
      meta: this.meta
        ? {
            version: this.meta.version,
            easytierVersion: this.meta.easytierVersion,
            targetTuple: this.meta.targetTuple,
          }
        : null,
      snapshot: {
        phase: this.phase,
        state: this.state,
        index: this.index,
        room: this.room,
        url: this.url,
        difficulty: this.difficulty,
        profiles: this.profiles.map((profile) => ({ ...profile })),
        error: this.error,
        exceptionType: this.exceptionType,
        latencyMs: this.latencyMs,
      },
      install: { ...this.installState },
    };
  }

  /** 解析当前可用二进制；未安装返回 installed:false / source:'none' */
  getBinaryInfo(): TcBinaryInfo {
    const resolved = this.resolveBinary();
    if (!resolved.path) {
      return { installed: false, path: '', version: '', source: 'none' };
    }
    const version = this.meta?.version
      ? normalizeVersion(this.meta.version)
      : inferVersionFromPath(resolved.path);
    return { installed: true, path: resolved.path, version, source: resolved.source };
  }

  /** 数据目录（运行时下载 / 日志所在目录） */
  getDataDir(): string {
    return path.join(app.getPath('userData'), 'terracotta');
  }

  // ---------- 二进制定位 ----------

  /**
   * 按优先级定位二进制：
   * 1. config.network.terracotta.binaryPath（自定义，文件或目录均可）
   * 2. 打包内置 <resources>/terracotta
   * 3. dev 仓库 build/terracotta
   * 4. userData/terracotta（运行时下载）
   */
  private resolveBinary(): { path: string; source: TcBinaryInfo['source'] } {
    const configured = (getConfig().network.terracotta?.binaryPath ?? '').trim();
    if (configured) {
      const stat = safeStat(configured);
      if (stat?.isFile() && isUsableBinary(configured)) {
        return { path: configured, source: 'custom' };
      }
      if (stat?.isDirectory()) {
        const found = findExecutableIn(configured);
        if (found) return { path: found, source: 'custom' };
      }
      log.warn(`[terracotta] 自定义二进制不可用，回退自动定位：${configured}`);
    }

    const candidates: { dir: string; source: TcBinaryInfo['source'] }[] = [];
    // 打包内置（electron-builder extraResources → <resources>/terracotta）
    candidates.push({ dir: path.join(process.resourcesPath, 'terracotta'), source: 'bundled' });
    // 开发模式：仓库 build/terracotta（__dirname 为 electron-dist/core，上两级是仓库根）
    if (!app.isPackaged) {
      candidates.push({ dir: path.join(__dirname, '..', '..', 'build', 'terracotta'), source: 'dev' });
    }
    // 运行时下载
    candidates.push({ dir: this.getDataDir(), source: 'downloaded' });

    for (const candidate of candidates) {
      const found = findExecutableIn(candidate.dir);
      if (found) return { path: found, source: candidate.source };
    }
    return { path: '', source: 'none' };
  }

  // ---------- 安装 ----------

  /**
   * 运行时下载安装。
   * 已安装且非强制时直接返回；安装进行中复用当前任务（不重复下载）。
   * 立即返回当前状态，进度经 `terracotta:install-progress` / `terracotta:status` 广播。
   */
  install(force = false): TerracottaStatus {
    if (this.installPromise) return this.getStatus();
    if (!force) {
      const binary = this.resolveBinary();
      if (binary.path) return this.getStatus();
    }
    this.installPromise = this.performInstall(force).finally(() => {
      this.installPromise = null;
    });
    return this.getStatus();
  }

  private async performInstall(_force: boolean): Promise<void> {
    const versionTag = resolveVersionTag();
    const targetDir = this.getDataDir();
    const tmpDir = `${targetDir}.tmp-${Date.now()}`;

    try {
      const targetSuffix = platformAssetSuffix();
      if (!targetSuffix) {
        throw new Error(`暂不支持当前平台：${process.platform}-${process.arch}`);
      }

      this.setInstall(
        {
          active: true,
          stage: 'download',
          percent: 0,
          transferred: 0,
          total: 0,
          message: `正在获取陶瓦联机 ${versionTag} 版本信息…`,
        },
        true,
      );
      const asset = await resolveReleaseAsset(versionTag, targetSuffix);

      fs.mkdirSync(tmpDir, { recursive: true });
      const archivePath = path.join(tmpDir, 'pkg.tar.gz');
      log.info(`[terracotta] 开始下载 ${asset.url}`);
      await downloadWithProgress(asset.url, archivePath, asset.size, (transferred, total) => {
        const percent = total > 0 ? Math.min(99, Math.round((transferred / total) * 100)) : 0;
        this.setInstall({
          active: true,
          stage: 'download',
          percent,
          transferred,
          total,
          message: `正在下载陶瓦联机 ${versionTag}…`,
        });
      });

      this.setInstall(
        { active: true, stage: 'extract', percent: 100, message: '正在解压陶瓦联机…' },
        true,
      );
      extractTarGz(archivePath, tmpDir);
      fs.rmSync(archivePath, { force: true });

      this.setInstall(
        { active: true, stage: 'verify', percent: 100, message: '正在校验陶瓦联机…' },
        true,
      );
      const exePath = findExecutableIn(tmpDir);
      if (!exePath) throw new Error('安装包中未找到 terracotta 可执行文件');
      const exeStat = fs.statSync(exePath);
      if (exeStat.size <= MIN_BINARY_SIZE) {
        throw new Error(`可执行文件大小异常（${exeStat.size} 字节）`);
      }

      // 校验通过后再替换旧目录：先删旧目录，再整体 rename（同一 userData 卷内原子性足够）
      // Windows 下运行中的 exe 目录无法删除：如果当前跑的正是 data 目录里的旧版本，先优雅停止
      const runningBinary = this.resolveBinary().path;
      const runningFromTarget =
        runningBinary !== '' &&
        path.resolve(runningBinary).startsWith(path.resolve(targetDir) + path.sep);
      if (runningFromTarget && this.phase !== 'stopped') {
        log.info('[terracotta] 安装目标目录内有运行中的二进制，先停止服务');
        await this.stop().catch(() => undefined);
      }
      if (fs.existsSync(targetDir)) fs.rmSync(targetDir, { recursive: true, force: true });
      fs.mkdirSync(path.dirname(targetDir), { recursive: true });
      fs.renameSync(tmpDir, targetDir);
      log.info(`[terracotta] 安装完成：${targetDir}（${versionTag}）`);

      this.setInstall(
        {
          active: false,
          stage: 'done',
          percent: 100,
          transferred: this.installState.transferred,
          total: this.installState.total,
          message: `陶瓦联机 ${versionTag} 安装完成`,
        },
        true,
      );
      this.emitStatus(true);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      log.error(`[terracotta] 安装失败：${message}`);
      this.setInstall({ active: false, stage: 'error', percent: 0, message }, true);
      this.emitStatus(true);
    } finally {
      // 失败/中断留下的临时目录清掉；成功时 tmpDir 已被 rename，不再存在
      try {
        if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        /* 清理失败不影响主流程 */
      }
    }
  }

  // ---------- 启动 / 停止 ----------

  /**
   * 启动器默认启动时调用：先确保联机组件存在（缺失则自动下载安装），再拉起本地服务。
   * 任何一步失败都会抛出，由调用方记录日志（不影响启动器本身启动）。
   */
  async ensureReady(): Promise<TerracottaStatus> {
    if (!this.getBinaryInfo().installed) {
      log.info('[terracotta] 未检测到联机组件，开始自动安装');
      this.install(false);
      // install() 立即返回状态，真正进度在 installPromise 里
      await this.installPromise?.catch(() => undefined);
      if (!this.getBinaryInfo().installed) {
        throw new Error('陶瓦联机组件安装未完成');
      }
      log.info('[terracotta] 联机组件安装完成');
    }
    return this.start();
  }

  /** 启动服务；未安装时抛「陶瓦联机尚未安装」 */
  async start(_payload?: TcStartPayload): Promise<TerracottaStatus> {
    if (this.phase === 'running') return this.getStatus();
    if (this.startPromise) return this.startPromise;
    this.startPromise = this.doStart();
    try {
      return await this.startPromise;
    } finally {
      this.startPromise = null;
    }
  }

  private async doStart(): Promise<TerracottaStatus> {
    const binary = this.resolveBinary();
    if (!binary.path) throw new Error('陶瓦联机尚未安装');

    const lifecycle = this.lifecycle;
    this.phase = 'starting';
    this.processError = null;
    this.error = '';
    this.emitStatus(true);

    const portFile = this.portFilePath();
    try {
      fs.rmSync(portFile, { force: true });
    } catch {
      /* 删不掉就覆盖写，不影响 */
    }

    log.info(`[terracotta] 启动：${binary.path} --hmcl ${portFile}`);
    const child = spawn(binary.path, ['--hmcl', portFile], {
      cwd: path.dirname(binary.path),
      stdio: 'ignore',
      windowsHide: true,
    }) as unknown as TerracottaChildProcess;
    this.child = child;

    child.on('error', (err) => {
      const message = `启动陶瓦联机失败：${err.message}`;
      log.error(`[terracotta] ${message}`);
      this.processError = message;
      if (this.phase === 'starting') {
        this.phase = 'crashed';
        this.error = message;
        this.emitStatus(true);
      }
    });
    // ⚠️ 刻意忽略 exit：Windows 下 --hmcl 引导进程写完端口文件就会退出，
    // 真正的工作进程是 detached 子进程。存活判定只走 /state 轮询。
    child.on('exit', (code) => {
      this.child = null;
      log.debug(`[terracotta] --hmcl 引导进程退出（code=${code}），按预期忽略`);
    });

    let port: number;
    try {
      port = await this.waitForPortFile(portFile, START_TIMEOUT_MS, lifecycle);
    } catch (e) {
      if (lifecycle !== this.lifecycle) return this.getStatus();
      this.phase = 'crashed';
      this.error = this.processError ?? (e instanceof Error ? e.message : String(e));
      this.emitStatus(true);
      throw new Error(this.error);
    }
    if (lifecycle !== this.lifecycle) return this.getStatus();

    this.port = port;
    const client = createTcHttpClient(port);
    try {
      // 端口文件出现即代表 HTTP 已就绪；/meta 失败不致命（老版本可能没有），/state 必须可达
      this.meta = await client.getMeta().catch(() => null);
      const snapshot = await client.getState();
      this.applyState(snapshot);
    } catch (e) {
      if (lifecycle !== this.lifecycle) return this.getStatus();
      this.phase = 'crashed';
      this.port = 0;
      this.error = `陶瓦联机服务未响应：${e instanceof Error ? e.message : String(e)}`;
      this.emitStatus(true);
      throw new Error(this.error);
    }
    if (lifecycle !== this.lifecycle) return this.getStatus();

    this.phase = 'running';
    this.pollFailures = 0;
    log.info(`[terracotta] 服务已就绪，端口 ${port}`);
    this.startPolling();
    this.emitStatus(true);
    return this.getStatus();
  }

  /** 端口文件路径（固定临时文件名，spawn 前删除） */
  private portFilePath(): string {
    return path.join(app.getPath('temp'), 'koring-terracotta-port.json');
  }

  /** 轮询端口文件，超时抛错 */
  private waitForPortFile(portFile: string, timeoutMs: number, lifecycle: number): Promise<number> {
    const deadline = Date.now() + timeoutMs;
    return new Promise<number>((resolve, reject) => {
      const tick = (): void => {
        if (this.lifecycle !== lifecycle) {
          reject(new Error('启动已取消'));
          return;
        }
        try {
          const raw = fs.readFileSync(portFile, 'utf8');
          const parsed = JSON.parse(raw) as { port?: unknown };
          const port = typeof parsed.port === 'number' ? Math.floor(parsed.port) : 0;
          if (port > 0 && port <= MAX_PORT) {
            resolve(port);
            return;
          }
        } catch {
          /* 文件尚未出现 / 半截写入（上游是原子写，一般不会） */
        }
        if (Date.now() >= deadline) {
          reject(new Error('启动陶瓦联机超时（20 秒），请稍后重试'));
          return;
        }
        setTimeout(tick, PORT_FILE_POLL_MS);
      };
      tick();
    });
  }

  /** 优雅停止（/panic?peaceful=true；连接重置/失败视为成功） */
  async stop(): Promise<TerracottaStatus> {
    if (this.stopPromise) return this.stopPromise;
    this.stopPromise = this.doStop();
    try {
      return await this.stopPromise;
    } finally {
      this.stopPromise = null;
    }
  }

  private async doStop(): Promise<TerracottaStatus> {
    this.stopPolling();
    const lifecycle = this.lifecycle;

    let port = this.phase === 'running' ? this.port : 0;
    if (this.phase === 'starting') {
      // 启动途中被要求停止：最多再等 3s 端口文件出现，拿到端口后照样 /panic 优雅关闭，
      // 避免退出后残留 worker（Windows 下工作进程是 detached 的）。
      try {
        port = await Promise.race([
          this.waitForPortFile(this.portFilePath(), 3000, lifecycle),
          new Promise<number>((resolve) => {
            setTimeout(() => resolve(0), 3000);
          }),
        ]);
      } catch {
        port = 0;
      }
    }

    // 自增生命周期：让仍在进行的 doStart 在下一个检查点收手
    this.lifecycle += 1;

    if (port > 0) {
      const client = createTcHttpClient(port);
      await client.panic();
    }

    this.child = null;
    this.phase = 'stopped';
    this.port = 0;
    this.meta = null;
    this.error = '';
    this.resetStateFields();
    // 房间关闭上报（best-effort，最多等 1.5s，避免卡住退出）
    await this.flushRoomReport(1500);
    log.info('[terracotta] 服务已停止');
    this.emitStatus(true);
    return this.getStatus();
  }

  // ---------- 控制 ----------

  /** 开房（未运行会先启动；调用后立即刷新一次状态，其余交给轮询） */
  async host(payload: TcHostPayload): Promise<TerracottaStatus> {
    return this.withRunning(async () => {
      const client = createTcHttpClient(this.port);
      await client.scanning({
        player: this.resolvePlayer(payload.player),
        publicNodes: this.resolvePublicNodes(payload.publicNodes),
      });
      await this.refreshState();
      return this.getStatus();
    });
  }

  /** 加入房间（本地预校验 + 上游 400 都转成可读错误） */
  async guest(payload: TcGuestPayload): Promise<TerracottaStatus> {
    const room = (payload.room ?? '').trim();
    if (!isValidRoomCode(room)) {
      throw new Error('房间码格式不正确，请检查后重试');
    }
    return this.withRunning(async () => {
      const client = createTcHttpClient(this.port);
      await client.guesting({
        room,
        player: this.resolvePlayer(payload.player),
        publicNodes: this.resolvePublicNodes(payload.publicNodes),
      });
      await this.refreshState();
      return this.getStatus();
    });
  }

  /**
   * 重置回 waiting（/state/ide）。
   * 已知缺陷：在非 waiting 状态调用可能让上游进程直接消失 —— 此时按契约视为重置成功，
   * 直接把 phase 置为 stopped，避免 UI 卡在异常态。
   */
  async reset(): Promise<TerracottaStatus> {
    if (this.phase !== 'running' || this.port <= 0) {
      throw new Error('陶瓦联机服务未运行');
    }
    const client = createTcHttpClient(this.port);
    try {
      await client.resetState();
      // 给状态机一点时间落回 waiting，再刷新一次
      await new Promise<void>((resolve) => setTimeout(resolve, 120));
      this.applyState(await client.getState());
      this.emitStatus(true);
    } catch (e) {
      log.warn(
        `[terracotta] 重置状态失败（按已知缺陷处理为已停止）：${
          e instanceof Error ? e.message : String(e)
        }`,
      );
      this.stopPolling();
      this.phase = 'stopped';
      this.port = 0;
      this.meta = null;
      this.error = '';
      this.resetStateFields();
      this.emitStatus(true);
    }
    return this.getStatus();
  }

  /** 读取上游 application.log（未运行时回退读二进制目录里的日志文件） */
  async fetchLog(): Promise<string> {
    if (this.phase === 'running' && this.port > 0) {
      try {
        return await createTcHttpClient(this.port).fetchLog();
      } catch (e) {
        log.warn(
          `[terracotta] 通过 HTTP 读取日志失败，回退读文件：${
            e instanceof Error ? e.message : String(e)
          }`,
        );
      }
    }
    const binary = this.resolveBinary();
    if (binary.path) {
      try {
        return fs.readFileSync(path.join(path.dirname(binary.path), 'application.log'), 'utf8');
      } catch {
        /* 没有日志文件 */
      }
    }
    return '';
  }

  /** 清除自定义二进制路径（恢复自动定位） */
  clearCustomBinary(): TerracottaStatus {
    if (getConfig().network.terracotta?.binaryPath) {
      updateConfig({ network: { terracotta: { binaryPath: '' } } });
    }
    this.emitStatus(true);
    return this.getStatus();
  }

  /** 确保服务在运行（未运行时自动启动） */
  private async withRunning(action: () => Promise<TerracottaStatus>): Promise<TerracottaStatus> {
    if (this.phase !== 'running') {
      await this.start();
    }
    return action();
  }

  // ---------- 轮询 ----------

  private startPolling(): void {
    this.stopPolling();
    this.pollTimer = setTimeout(() => {
      void this.pollOnce();
    }, POLL_INTERVAL_MS);
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private async pollOnce(): Promise<void> {
    if (this.phase !== 'running' || this.port <= 0) return;
    try {
      const startedAt = Date.now();
      const snapshot = await createTcHttpClient(this.port).getState();
      this.latencyMs = Math.max(1, Date.now() - startedAt);
      this.pollFailures = 0;
      this.applyState(snapshot);
      this.emitStatus();
    } catch (e) {
      this.pollFailures += 1;
      log.warn(
        `[terracotta] /state 轮询失败（${this.pollFailures}/${MAX_POLL_FAILURES}）：${
          e instanceof Error ? e.message : String(e)
        }`,
      );
      if (this.pollFailures >= MAX_POLL_FAILURES) {
        this.phase = 'crashed';
        this.port = 0;
        this.error = '陶瓦联机服务已退出或无法连接';
        this.stopPolling();
        // 服务已死，房间不可能再被访问：把网页端房间也一并关闭
        this.closeRoomReport();
        this.emitStatus(true);
        return;
      }
    }
    if (this.phase === 'running') this.startPolling();
  }

  /** 应用一次 /state 快照（index 更旧的响应丢弃，避免乱序覆盖） */
  private applyState(snapshot: ParsedTcState): void {
    if (snapshot.index < this.index) return;
    this.state = snapshot.state;
    this.index = snapshot.index;
    this.room = snapshot.room;
    this.url = snapshot.url;
    this.difficulty = snapshot.difficulty;
    this.profiles = snapshot.profiles;
    this.exceptionType = snapshot.state === 'exception' ? snapshot.exceptionType : -1;
    this.error = snapshot.state === 'exception' ? describeTcException(snapshot.exceptionType) : '';
    this.syncRoomReport();
  }

  private resetStateFields(): void {
    this.state = 'waiting';
    this.index = 0;
    this.room = '';
    this.url = '';
    this.difficulty = '';
    this.profiles = [];
    this.exceptionType = -1;
    this.error = '';
    this.latencyMs = 0;
    // 服务停止 / 房间消失：把已上报的网页房间一并关闭
    this.syncRoomReport();
  }

  // ---------- 网页房间上报 ----------

  /**
   * 房间上报：host-ok 期间把房间号登记到网页端（邀请链接靠它生效），
   * 离开 host-ok（房主手动关闭、陶瓦自关、异常、停服、退出）时上报关闭。
   * 全程 best-effort：未登录 / 网络失败只记 warn，绝不影响联机本身。
   * 失败会自动重试（服务端故障恢复后无需重开房间）。
   */
  private syncRoomReport(): void {
    const code = this.state === 'host-ok' ? fullRoomCode(this.room) : '';

    if (!code) {
      this.abandonRoomReport();
      return;
    }
    if (code === this.reportedRoom) return;

    if (code !== this.openReportRoom) {
      // 新房间：重置尝试状态，并把旧房间（如果上报成功过）关掉
      this.closeRoomReport();
      this.openReportRoom = code;
      this.openReportBlockedUntil = 0;
      this.openReportWarned = false;
    }
    if (Date.now() < this.openReportBlockedUntil) return;
    this.enqueueRoomReport('open', code);
  }

  /** 离开 host-ok：若已上报过则关闭，并清空尝试状态 */
  private abandonRoomReport(): void {
    this.closeRoomReport();
    this.openReportRoom = '';
    this.openReportBlockedUntil = 0;
    this.openReportWarned = false;
  }

  /** 上报关闭（仅在 open 成功过之后才需要；失败也只 warn） */
  private closeRoomReport(): void {
    const code = this.reportedRoom;
    this.reportedRoom = '';
    this.openReportRoom = '';
    if (!code) return;
    this.enqueueRoomReport('close', code);
  }

  /** 上报排队执行：保证 open 先于 close，退出时还能等它落地 */
  private enqueueRoomReport(action: 'open' | 'close', code: string): void {
    this.roomReportQueue = this.roomReportQueue.then(() => this.runRoomReport(action, code));
  }

  /** 等待已排队的房间上报完成（退出流程用，最多等 timeoutMs） */
  async flushRoomReport(timeoutMs = 1500): Promise<void> {
    await Promise.race([
      this.roomReportQueue.catch(() => undefined),
      new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
    ]);
  }

  private async runRoomReport(action: 'open' | 'close', code: string): Promise<void> {
    try {
      const data = action === 'open' ? await reportRoomOpen(code) : await reportRoomClose(code);
      if (action === 'open') {
        this.reportedRoom = code;
        this.openReportBlockedUntil = 0;
        this.openReportWarned = false;
      }
      log.info(`[terracotta] 网页房间已上报 ${action}：${code} → ${data.state}`);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (action === 'close') {
        // room_not_found（从未上报过）/ 服务端故障，都不该打扰玩家
        log.debug(`[terracotta] 房间关闭上报跳过：${message}`);
        return;
      }
      // 开启失败：15s 后自动重试（服务端 5xx / 网络抖动都能自愈），warn 只打一次
      this.openReportBlockedUntil = Date.now() + ROOM_REPORT_RETRY_MS;
      if (!this.openReportWarned) {
        this.openReportWarned = true;
        log.warn(
          `[terracotta] 房间开启上报失败（${code}）：${message}；已改为每 ${Math.round(
            ROOM_REPORT_RETRY_MS / 1000,
          )}s 自动重试`,
        );
      } else {
        log.debug(`[terracotta] 房间开启上报仍在失败：${message}`);
      }
    }
  }

  /** 主动刷新一次状态（开房/加入后立即给 UI 反馈） */
  private async refreshState(): Promise<void> {
    if (this.port <= 0) return;
    try {
      const startedAt = Date.now();
      const snapshot = await createTcHttpClient(this.port).getState();
      this.latencyMs = Math.max(1, Date.now() - startedAt);
      this.applyState(snapshot);
      this.emitStatus(true);
    } catch {
      /* 失败交给轮询处理 */
    }
  }

  // ---------- 参数默认值 ----------

  /**
   * 显示名缺省顺序：入参 → 本机已登录的 Koring 账号用户名。
   * 不接受自定义昵称（设置页已移除该项），显示名始终跟随 Koring 账号。
   */
  private resolvePlayer(input?: string): string {
    const direct = typeof input === 'string' ? input.trim() : '';
    if (direct) return direct;

    const koringName = readKoringUsername();
    if (koringName) return koringName;

    try {
      const store = readAuthStore();
      const active =
        store.accounts.find((account) => account.id === store.activeAccountId) ?? store.accounts[0];
      return active?.username?.trim() ?? '';
    } catch {
      return '';
    }
  }

  /** 公共节点缺省取配置值；入参为空数组时视为显式不附加 */
  private resolvePublicNodes(input?: string[]): string[] {
    const source = Array.isArray(input) ? input : getConfig().network.terracotta?.publicNodes ?? [];
    return source.map((node) => node.trim()).filter((node) => node.length > 0);
  }

  // ---------- 广播 ----------

  private emitStatus(force = false): void {
    if (!this.broadcaster) return;
    const status = this.getStatus();
    const json = JSON.stringify(status);
    if (!force && json === this.lastStatusJson) return;
    this.lastStatusJson = json;
    this.lastStatusAt = Date.now();
    try {
      this.broadcaster('terracotta:status', status);
    } catch (e) {
      log.warn(`[terracotta] 状态广播失败：${e instanceof Error ? e.message : String(e)}`);
    }
  }

  /** 安装期间状态事件按较长间隔节流，进度本身走 install-progress 通道 */
  private emitStatusThrottled(): void {
    if (Date.now() - this.lastStatusAt < STATUS_DURING_INSTALL_THROTTLE_MS) return;
    this.emitStatus();
  }

  private setInstall(patch: Partial<TcInstallState>, force = false): void {
    const stageChanged = patch.stage !== undefined && patch.stage !== this.installState.stage;
    this.installState = { ...this.installState, ...patch };
    const now = Date.now();
    if (force || stageChanged || now - this.lastInstallEmitAt >= INSTALL_PROGRESS_THROTTLE_MS) {
      this.lastInstallEmitAt = now;
      try {
        this.broadcaster?.('terracotta:install-progress', this.installState);
      } catch {
        /* 广播异常忽略 */
      }
    }
    this.emitStatusThrottled();
  }
}

/** 主进程全局单例（handler / main.ts 共用） */
export const terracottaService = new TerracottaService();
