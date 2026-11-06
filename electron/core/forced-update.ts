import electron from 'electron';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { compareVersionTags, getMirrors } from '../updater';
import { createLogger } from './logger';

const { app } = electron;

const log = createLogger('forced-update');

const OWNER = 'dream-pep';
const REPO = 'koring-launcher';

/** 强制升级页面的状态机 */
export type ForcedUpdateState =
  | 'idle'
  | 'resolving'
  | 'downloading'
  | 'downloaded'
  | 'installing'
  | 'error';

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
  /** 已下载安装包的完整路径（安装时使用） */
  filePath?: string;
  /** 是否为开发模式（dev 下点击安装仅重启应用，不执行安装） */
  dev: boolean;
  error?: string;
}

interface ReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

interface ReleaseInfo {
  tag_name: string;
  draft: boolean;
  prerelease: boolean;
  assets: ReleaseAsset[];
}

/** 只认 Windows 安装包 */
const SETUP_EXE_RE = /-setup\.exe$/i;
/** 安装包文件名 → 版本号（koring-launcher-1.2.7-44-setup.exe） */
const FILE_VERSION_RE = /koring-launcher-(\d+\.\d+\.\d+(?:-\d+(?:\.beta)?)?)-setup\.exe$/i;
const USER_AGENT = 'koring-launcher-armed-updater';
const API_TIMEOUT_MS = 15_000;
/** 进度广播节流（毫秒） */
const PROGRESS_THROTTLE_MS = 120;

/**
 * 强制升级（受 API 版本策略控制）的下载 / 安装服务。
 *
 * 与 electron-updater 驱动的常规更新不同：
 * - 无需 latest.yml / sha512 核验，直接按目标版本从 GitHub Release 抓取 `*-setup.exe`；
 * - 进度经 `forced-update:status` 广播给渲染进程（强下载页面的大圆环）；
 * - 下载完成后「立即安装」不做任何二次校验，直接静默安装（/S）并退出；
 * - 开发模式（未打包）下仍可下载，但点击安装只重启应用，避免破坏开发环境。
 */
export class ForcedUpdateService {
  private listener: ((status: ForcedUpdateStatus) => void) | null = null;
  private status: ForcedUpdateStatus = {
    state: 'idle',
    percent: 0,
    transferred: 0,
    total: 0,
    dev: !app.isPackaged,
  };
  /** 进行中的任务（避免页面重挂载重复触发下载） */
  private running: Promise<ForcedUpdateStatus> | null = null;
  private lastEmitAt = 0;

  init(listener: (status: ForcedUpdateStatus) => void): void {
    this.listener = listener;
  }

  getStatus(): ForcedUpdateStatus {
    return { ...this.status, dev: !app.isPackaged };
  }

  /** 安装包落盘目录（userData/update-installer） */
  getDownloadDir(): string {
    return path.join(app.getPath('userData'), 'update-installer');
  }

  /**
   * 进入强下载页面时调用：解析目标版本 → 检查本地已有安装包 → 没有则开始下载。
   * @param requestedVersion API 下发的目标版本（可空，空则取最新正式版）
   */
  async prepare(requestedVersion?: string): Promise<ForcedUpdateStatus> {
    if (this.running) return this.running;
    this.running = this.doPrepare(requestedVersion).finally(() => {
      this.running = null;
    });
    return this.running;
  }

  /** 点击「立即安装」：不校验，直接静默安装（dev 下仅重启） */
  async install(): Promise<ForcedUpdateStatus> {
    const { state, filePath } = this.status;
    if (state !== 'downloaded' || !filePath) {
      throw new Error('安装包尚未下载完成');
    }
    if (!fs.existsSync(filePath)) {
      throw new Error('安装包已被删除，请重新下载');
    }
    this.set({ state: 'installing', percent: 100, error: undefined });

    if (!app.isPackaged) {
      log.info('[forced-update] 开发模式：点击安装仅重启应用');
      setTimeout(() => {
        app.relaunch();
        app.exit(0);
      }, 300);
      return this.getStatus();
    }

    log.info(`[forced-update] 静默安装：${filePath}`);
    const child = spawn(filePath, ['/S', '--force-run'], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    child.unref();
    setTimeout(() => app.quit(), 500);
    return this.getStatus();
  }

  // ---------------------------------------------------------------- 内部实现

  private async doPrepare(requestedVersion?: string): Promise<ForcedUpdateStatus> {
    try {
      if (process.platform !== 'win32') {
        throw new Error('当前平台暂不支持强制升级下载');
      }
      const want = normalizeVersion(requestedVersion);
      this.set({ state: 'resolving', percent: 0, transferred: 0, total: 0, error: undefined });

      let releases: ReleaseInfo[] = [];
      try {
        releases = await this.fetchReleases();
      } catch (e) {
        // 版本列表拿不到但知道确切目标版本时，仍可直接按约定命名尝试下载（安装包体积会从响应头读取）
        if (!want) throw e;
        log.warn(
          `[forced-update] 获取版本列表失败（${e instanceof Error ? e.message : String(e)}），按 v${want} 直接尝试下载`,
        );
      }
      const release =
        releases.length > 0
          ? this.selectRelease(releases, want)
          : want
            ? synthesizeRelease(want)
            : null;
      if (!release) {
        throw new Error(want ? `未找到版本 v${want} 对应的安装包` : '未找到可用的安装包');
      }
      const asset = release.assets.find((a) => SETUP_EXE_RE.test(a.name));
      if (!asset) throw new Error(`版本 v${release.tag_name} 未提供 Windows 安装包`);

      const version = versionFromTag(release.tag_name);
      const dir = this.getDownloadDir();
      fs.mkdirSync(dir, { recursive: true });

      // 先检查本地是否已经下载过符合要求的安装包（用户关闭启动器后再次进入）
      const existing = this.findExistingInstaller(version, want);
      if (existing) {
        log.info(`[forced-update] 复用已下载安装包：${existing.fileName}`);
        this.set({
          state: 'downloaded',
          percent: 100,
          transferred: existing.size,
          total: existing.size,
          version: existing.version,
          fileName: existing.fileName,
          filePath: path.join(dir, existing.fileName),
          error: undefined,
        });
        void this.pruneInstallers(existing.fileName);
        return this.getStatus();
      }

      const dest = path.join(dir, asset.name);
      await this.removePartialFiles(dir);
      await this.downloadAsset(asset, dest, version);
      this.set({
        state: 'downloaded',
        percent: 100,
        version,
        fileName: asset.name,
        filePath: dest,
        error: undefined,
      });
      log.info(`[forced-update] 下载完成：v${version} → ${dest}`);
      void this.pruneInstallers(asset.name);
      return this.getStatus();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      log.error(`[forced-update] 准备失败：${message}`);
      this.set({ state: 'error', error: message });
      return this.getStatus();
    }
  }

  /** 依次尝试 GitHub 与各加速源的 Release 列表接口（5xx/超时自动换源） */
  private async fetchReleases(): Promise<ReleaseInfo[]> {
    const bases = ['', ...getMirrors().map((m) => `${m}/`)];
    let lastError: unknown;
    for (const base of bases) {
      const url = `${base}https://api.github.com/repos/${OWNER}/${REPO}/releases?per_page=40`;
      try {
        const res = await fetch(url, {
          headers: {
            'User-Agent': USER_AGENT,
            Accept: 'application/vnd.github+json',
          },
          signal: AbortSignal.timeout(API_TIMEOUT_MS),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as ReleaseInfo[];
        if (Array.isArray(data) && data.length > 0) return data;
        throw new Error('返回为空');
      } catch (e) {
        lastError = e;
      }
    }
    throw new Error(
      `无法获取版本列表：${lastError instanceof Error ? lastError.message : String(lastError)}`,
    );
  }

  /**
   * 选择要下载的 release。
   * - 有目标版本：匹配同 base（含全部构建号）后取最高；匹配不到则回退最新正式版；
   * - 无目标版本：取最新正式版（不含 beta / 草稿）。
   */
  private selectRelease(releases: ReleaseInfo[], want?: string): ReleaseInfo | null {
    const usable = releases.filter(
      (r) => !r.draft && !r.prerelease && r.tag_name && r.assets.length > 0,
    );
    if (usable.length === 0) return null;
    const sorted = [...usable].sort((a, b) => compareVersionTags(b.tag_name, a.tag_name));

    if (want) {
      const matched = sorted.filter((r) => {
        const v = versionFromTag(r.tag_name).toLowerCase();
        return v === want.toLowerCase() || v.startsWith(`${want.toLowerCase()}-`);
      });
      if (matched.length > 0) return matched[0];
      log.warn(`[forced-update] 未找到 v${want} 的安装包，回退到最新正式版`);
    }
    return sorted[0] ?? null;
  }

  /** 检查下载目录里是否已有版本满足要求的安装包 */
  private findExistingInstaller(
    resolvedVersion: string,
    want?: string,
  ): { fileName: string; version: string; size: number } | null {
    const dir = this.getDownloadDir();
    let entries: string[];
    try {
      entries = fs.readdirSync(dir);
    } catch {
      return null;
    }
    const required = want ?? resolvedVersion;
    const candidates: { fileName: string; version: string; size: number }[] = [];
    for (const name of entries) {
      const m = FILE_VERSION_RE.exec(name);
      if (!m) continue;
      const full = path.join(dir, name);
      let size = 0;
      try {
        const stat = fs.statSync(full);
        if (!stat.isFile()) continue;
        size = stat.size;
      } catch {
        continue;
      }
      if (size <= 0) continue;
      candidates.push({ fileName: name, version: m[1], size });
    }
    candidates.sort((a, b) => compareVersionTags(b.version, a.version));
    return candidates.find((c) => compareVersionTags(c.version, required) >= 0) ?? null;
  }

  /** 清理上次中断留下的 .part 临时文件 */
  private async removePartialFiles(dir: string): Promise<void> {
    try {
      const entries = await fs.promises.readdir(dir);
      await Promise.all(
        entries
          .filter((n) => n.endsWith('.part'))
          .map((n) => fs.promises.rm(path.join(dir, n), { force: true }).catch(() => undefined)),
      );
    } catch {
      /* 目录不存在等场景忽略 */
    }
  }

  /** 只保留本次使用的安装包，清理之前版本残留（避免每次强制升级都占 100+ MB） */
  private async pruneInstallers(keepFileName: string): Promise<void> {
    try {
      const dir = this.getDownloadDir();
      const entries = await fs.promises.readdir(dir);
      await Promise.all(
        entries
          .filter((n) => n !== keepFileName && FILE_VERSION_RE.test(n))
          .map((n) => fs.promises.rm(path.join(dir, n), { force: true }).catch(() => undefined)),
      );
    } catch {
      /* 清理失败不影响主流程 */
    }
  }

  /** 下载安装包（优先加速源，直连 GitHub 兜底；进度经状态广播） */
  private async downloadAsset(
    asset: ReleaseAsset,
    dest: string,
    version: string,
  ): Promise<void> {
    // 国内网络直连 github.com/releases 常常超时，先走加速源能显著减少「0% 等待」时间
    const urls = [
      ...getMirrors().map((m) => `${m}/${asset.browser_download_url}`),
      asset.browser_download_url,
    ];
    const expectedSize = asset.size;
    this.set({
      state: 'downloading',
      percent: 0,
      transferred: 0,
      total: expectedSize,
      version,
      fileName: asset.name,
      filePath: dest,
      error: undefined,
    });

    const tmp = `${dest}.part`;
    let lastError: unknown;
    for (const url of urls) {
      try {
        await this.downloadOne(url, tmp, expectedSize);
        await fs.promises.rename(tmp, dest);
        return;
      } catch (e) {
        lastError = e;
        await fs.promises.rm(tmp, { force: true }).catch(() => undefined);
        log.warn(
          `[forced-update] 下载失败（${url}）：${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
    throw new Error(
      `安装包下载失败：${lastError instanceof Error ? lastError.message : String(lastError)}`,
    );
  }

  private downloadOne(url: string, tmp: string, expectedSize: number): Promise<void> {
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
                reject(new Error('重定向次数过多'));
                return;
              }
              request(new URL(res.headers.location, target).toString(), redirects + 1);
              return;
            }
            if (status !== 200) {
              res.resume();
              reject(new Error(`HTTP ${status}`));
              return;
            }
            const total = Number(res.headers['content-length'] ?? expectedSize) || expectedSize;
            let transferred = 0;
            const ws = fs.createWriteStream(tmp);
            res.on('data', (chunk: Buffer) => {
              transferred += chunk.length;
              this.reportProgress(transferred, total);
            });
            res.on('error', reject);
            ws.on('error', reject);
            ws.on('finish', () => {
              ws.close(() => {
                if (expectedSize > 0 && transferred !== expectedSize) {
                  reject(new Error(`安装包大小不符（${transferred}/${expectedSize}）`));
                  return;
                }
                resolve();
              });
            });
            res.pipe(ws);
          },
        );
        req.on('error', reject);
        // socket 空闲超时（数据流动时自动重置；用于连接挂起/长时间无响应时快速换源）
        req.setTimeout(30_000, () => {
          req.destroy(new Error('下载超时'));
        });
      };
      request(url, 0);
    });
  }

  private reportProgress(transferred: number, total: number): void {
    const percent = total > 0 ? Math.min(100, Math.round((transferred / total) * 100)) : 0;
    const now = Date.now();
    if (percent < 100 && now - this.lastEmitAt < PROGRESS_THROTTLE_MS) return;
    this.lastEmitAt = now;
    this.set({ state: 'downloading', percent, transferred, total });
  }

  private set(patch: Partial<ForcedUpdateStatus>): void {
    this.status = { ...this.status, ...patch, dev: !app.isPackaged };
    this.emit();
  }

  private emit(): void {
    try {
      this.listener?.(this.getStatus());
    } catch {
      /* 广播异常忽略 */
    }
  }
}

/** 去掉 v 前缀并去空格；空值返回 undefined */
function normalizeVersion(version?: string): string | undefined {
  const v = version?.trim().replace(/^v/i, '');
  return v ? v : undefined;
}

/** tag（v1.2.7-44）→ 版本号（1.2.7-44） */
function versionFromTag(tag: string): string {
  return tag.trim().replace(/^v/i, '');
}

/** 版本列表不可用时的兜底：按 electron-builder artifactName 约定拼出安装包地址 */
function synthesizeRelease(version: string): ReleaseInfo {
  const name = `koring-launcher-${version}-setup.exe`;
  return {
    tag_name: `v${version}`,
    draft: false,
    prerelease: false,
    assets: [
      {
        name,
        browser_download_url: `https://github.com/${OWNER}/${REPO}/releases/download/v${version}/${name}`,
        size: 0,
      },
    ],
  };
}

export const forcedUpdateService = new ForcedUpdateService();
