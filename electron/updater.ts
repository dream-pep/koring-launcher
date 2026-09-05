import { autoUpdater, CancellationToken, type ProgressInfo } from 'electron-updater';
import electron from 'electron';
import * as fs from 'fs';
import * as crypto from 'crypto';
import * as os from 'os';
import semver from 'semver';
import { getConfig, updateConfig, flushConfig } from './config';
import { createLogger } from './core/logger';

const { app } = electron;

const log = createLogger('updater');

export type UpdateState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'paused'
  | 'downloaded'
  | 'installing'
  | 'error';

export interface UpdateStatusPayload {
  state: UpdateState;
  /** 是否为手动触发（手动触发时前端不弹提示） */
  manual: boolean;
  /** 目标版本号 */
  version?: string;
  /** 当前安装版本 */
  currentVersion?: string;
  percent?: number;
  transferred?: number;
  total?: number;
  bytesPerSecond?: number;
  /** 当前使用的更新源（github=官方 / 加速源域名） */
  source?: string;
  /** 当前更新通道（woker / runner） */
  channel?: string;
  /** 安装包是否已通过本地核验（sha512 / 大小） */
  verified?: boolean;
  error?: string;
}

/** 更新通道 key（可扩展：新增通道只需在 UPDATE_CHANNELS 注册） */
export type UpdateChannelKey = 'woker' | 'runner';

export interface UpdateChannelDef {
  key: UpdateChannelKey;
  /** 显示名 */
  label: string;
  /** 说明 */
  desc: string;
  /** 是否接收预览版（runner 可收 beta；woker 只收正式版） */
  allowPrerelease: boolean;
}

/**
 * 更新通道注册表（后期扩展新通道：在此追加一项即可，UI 通过 update:getChannels 动态渲染）。
 * - woker（慢走模式，默认）：仅检查/获取正式版（稳定）更新
 * - runner（跑步模式）：可获取预览版（测试版）更新
 */
const UPDATE_CHANNELS: UpdateChannelDef[] = [
  { key: 'woker', label: '慢走模式', desc: '仅获取正式版更新（稳定）', allowPrerelease: false },
  { key: 'runner', label: '跑步模式', desc: '可获取预览版（测试版）更新', allowPrerelease: true },
];

function getChannelDef(key: string): UpdateChannelDef {
  return UPDATE_CHANNELS.find((c) => c.key === key) ?? UPDATE_CHANNELS[0];
}

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

const OWNER = 'dream-pep';
const REPO = 'koring-launcher';
const DISCOVER_TIMEOUT_MS = 15000;

/**
 * 内置加速源（ghproxy 类，代理完整 GitHub URL；latest.yml 的相对路径可解析）。
 * 实测（2026-08-30）：gh.ddlc.top / gh-proxy.com / ghfast.top 行为正确（按原状转发，404 即 404）；
 * ghps.cc 已被移除——它对任何请求都返回 200 + HTML 跳转拦截页，会污染 latest.yml / release-notes.md。
 * 第三方服务稳定性有限，可用环境变量 UPDATE_MIRRORS 覆盖（逗号分隔），
 * 后续建议换成自建 OSS/CDN 镜像（generic provider 直接指向镜像根目录）。
 */
const DEFAULT_MIRRORS: string[] = ['https://gh.ddlc.top', 'https://gh-proxy.com', 'https://ghfast.top'];

function getMirrors(): string[] {
  const env = process.env.UPDATE_MIRRORS;
  if (env) {
    return env.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return DEFAULT_MIRRORS;
}

/** 版本格式分类 */
type TagKind = 'stable' | 'beta' | 'oldbeta' | 'plain';

interface ParsedTag {
  base: number[];
  /** 构建号（渠道标记不参与排序） */
  num: number;
  kind: TagKind;
}

/**
 * 项目版本格式（2026- 起）：
 *   - 正式版（run）：   {base}-{N}         如 1.2.6-25
 *   - 测试版（beta）：  {base}-{N}.beta    如 1.2.6-16.beta（编号在前、beta 在后）
 *   - 旧测试版（废弃）：{base}-beta.{N}    如 1.2.6-beta.16 —— 检测时【屏蔽】不作为候选
 *   - 旧正式版（更早）：{base}             如 1.2.5（无构建号，同 base 最旧）
 */
function parseTag(tag: string): ParsedTag {
  const s = tag.replace(/^v/i, '');
  const dash = s.indexOf('-');
  const baseStr = dash === -1 ? s : s.slice(0, dash);
  const tail = dash === -1 ? '' : s.slice(dash + 1);
  const nums = baseStr.split('.').map((n) => parseInt(n, 10) || 0);
  while (nums.length < 3) nums.push(0);
  if (tail === '') return { base: nums, num: -1, kind: 'plain' };
  const mStable = /^(\d+)$/.exec(tail);
  if (mStable) return { base: nums, num: parseInt(mStable[1], 10), kind: 'stable' };
  const mBeta = /^(\d+)\.beta$/i.exec(tail);
  if (mBeta) return { base: nums, num: parseInt(mBeta[1], 10), kind: 'beta' };
  const mOldBeta = /^beta\.(\d+)$/i.exec(tail);
  if (mOldBeta) return { base: nums, num: parseInt(mOldBeta[1], 10), kind: 'oldbeta' };
  // 无法识别 → 视为未知旧格式（候选阶段一并屏蔽），构建号取 0
  return { base: nums, num: 0, kind: 'oldbeta' };
}

/** 该 tag 是否为"屏蔽的旧格式"（旧 beta：-beta.N 或无法识别的尾巴） */
function isMaskedLegacyTag(tag: string): boolean {
  return parseTag(tag).kind === 'oldbeta';
}

/** 候选是否允许当前通道使用（woker=仅正式；runner=正式+新版测试版；旧格式一律屏蔽） */
function isCandidateAllowed(tag: string, allowPrerelease: boolean): boolean {
  if (isMaskedLegacyTag(tag)) return false;
  const kind = parseTag(tag).kind;
  return allowPrerelease || kind === 'stable' || kind === 'plain';
}

/**
 * 项目版本序：比较两个版本 tag，返回 a - b。
 * base 数值优先；base 相同比构建号（数字部分）——beta/正式只是通道标记，不参与新旧排序。
 * 旧格式（-beta.N）按构建号参与排序（使旧版安装也能升级到新格式/更高构建号），
 * 但不会作为候选被选中（见 isCandidateAllowed）。
 */
function compareVersionTags(a: string, b: string): number {
  const pa = parseTag(a);
  const pb = parseTag(b);
  for (let i = 0; i < 3; i++) {
    if (pa.base[i] !== pb.base[i]) return pa.base[i] - pb.base[i];
  }
  return pa.num - pb.num;
}

/**
 * 更新服务：electron-updater（GitHub provider）+ 加速源兜底。
 * 状态：idle → checking → available → downloading ⇄ paused → downloaded → installing → quitAndInstall
 * 下载控制：CancellationToken 实现暂停（中断）/继续/取消。
 * 进度持久化：每次状态/进度变化写入 Koring.yml 的 update 段（下载与安装进度落盘）。
 */
class UpdateService {
  private state: UpdateState = 'idle';
  private manual = false;
  private version: string | undefined;
  private currentVersion = '';
  private progress: ProgressInfo | null = null;
  private source = 'github';
  private error: string | undefined;
  private listener: ((payload: UpdateStatusPayload) => void) | null = null;
  private ready = false;
  /** 检查过程中屏蔽 error 事件（避免 GitHub 失败被当成最终错误） */
  private suppressErrors = false;
  /** 当前下载的取消令牌（暂停/取消时 cancel） */
  private downloadToken: CancellationToken | null = null;
  /** 目标安装包是否已通过本地核验（sha512 + 大小），核验通过前不允许安装 */
  private verified = false;
  /** update-available 时记录的期望 sha512（来自 latest.yml） */
  private expectedSha512 = '';
  /** 期望文件大小（字节） */
  private expectedSize = 0;
  /** 当前更新通道（woker 慢走 / runner 跑步；从配置读取，可运行时切换） */
  private channelKey: UpdateChannelKey = 'woker';

  init(listener: (payload: UpdateStatusPayload) => void): void {
    this.listener = listener;
    this.currentVersion = app.getVersion();

    if (!app.isPackaged) {
      log.info('[updater] 开发模式：跳过自动更新');
      this.emit();
      return;
    }

    // 恢复持久化的更新通道
    const persistedChannel = getConfig().update?.channel;
    if (persistedChannel && UPDATE_CHANNELS.some((c) => c.key === persistedChannel)) {
      this.channelKey = persistedChannel as UpdateChannelKey;
    }

    // 应用能启动即说明上次安装已完成/已结束，清理持久化的进行中状态
    const persisted = getConfig().update;
    if (persisted && persisted.state && persisted.state !== 'idle') {
      log.info(`[updater] 上次更新状态 ${persisted.state} (v${persisted.version})，已重置`);
      this.persistIdleConfig();
    }

    autoUpdater.autoDownload = false;
    // 安装一律走我们受控的 quitAndInstall（含核验与确认弹窗），
    // 禁止 electron-updater 在退出时静默自动安装（否则未核验/核验失败的包可能被直接装上）
    autoUpdater.autoInstallOnAppQuit = false;
    this.applyChannel();
    autoUpdater.logger = console;
    autoUpdater.on('checking-for-update', () => {
      this.state = 'checking';
      this.emit();
    });
    autoUpdater.on('update-available', (info) => {
      this.state = 'available';
      this.version = info.version;
      this.error = undefined;
      this.verified = false;
      // 记录期望安装包校验值（来自 latest.yml 的 files[0]）
      const anyInfo = info as unknown as { files?: Array<{ sha512?: string; size?: number }> };
      const first = Array.isArray(anyInfo?.files) ? anyInfo.files[0] : null;
      this.expectedSha512 = String(first?.sha512 ?? '');
      this.expectedSize = Number(first?.size ?? 0);
      log.info(`[updater] 可用更新 ${info.version}，期望 sha512=${this.expectedSha512.slice(0, 12)}… size=${this.expectedSize}`);
      this.emit();
    });
    autoUpdater.on('update-not-available', () => {
      this.state = 'not-available';
      this.version = undefined;
      this.verified = false;
      this.emit();
    });
    autoUpdater.on('download-progress', (p) => {
      this.state = 'downloading';
      this.progress = p;
      this.emit();
    });
    // 下载完成 → 本地核验安装包（sha512 + 大小）。
    //   · 通过：进入"已下载可安装"（verified=true）
    //   · 失败：仍进入"已下载"，但 verified=false + 记录原因 —— 点"安装"会弹确认框
    //     （继续安装 / 取消并删除安装包），绝不静默安装未核验包
    autoUpdater.on('update-downloaded', async (info) => {
      const errMsg = await this.verifyDownloadedPackage();
      if (errMsg) {
        log.error(`[updater] 安装包核验失败: ${errMsg}`);
        this.state = 'downloaded';
        this.verified = false;
        this.version = info.version;
        this.error = errMsg;
        this.emit();
        return;
      }
      log.info('[updater] 安装包核验通过（sha512 + 大小）');
      this.state = 'downloaded';
      this.verified = true;
      this.version = info.version;
      this.error = undefined;
      this.emit();
    });
    autoUpdater.on('error', (err: Error) => {
      const message = String(err?.message ?? err);
      log.warn(`[updater] electron-updater error: ${message}`);
      if (this.suppressErrors) return; // 兜底循环内，忽略
      if (this.downloadToken?.cancelled) return; // 主动暂停/取消，忽略
      this.state = 'error';
      this.error = message;
      this.emit();
    });

    this.ready = true;
  }

  private emit(): void {
    const payload = this.buildPayload();
    this.listener?.(payload);
    this.persist(payload);
  }

  private buildPayload(): UpdateStatusPayload {
    return {
      state: this.state,
      manual: this.manual,
      version: this.version,
      currentVersion: this.currentVersion,
      percent: this.progress?.percent,
      transferred: this.progress?.transferred,
      total: this.progress?.total,
      bytesPerSecond: this.progress?.bytesPerSecond,
      source: this.source,
      channel: this.channelKey,
      verified: this.verified,
      error: this.error,
    };
  }

  /**
   * 本地核验已下载的安装包（在安装前执行）：
   * 1) 文件存在性；
   * 2) 大小与 latest.yml 记录一致（有期望值时）；
   * 3) sha512 与 latest.yml 记录一致（逐块流式计算，防篡改/下载损坏）。
   * 返回 null = 通过；返回字符串 = 失败原因（调用方进入 error，拒绝安装）。
   */
  private async verifyDownloadedPackage(): Promise<string | null> {
    const helper = (autoUpdater as unknown as { downloadedUpdateHelper?: { file?: string } }).downloadedUpdateHelper;
    const filePath = helper?.file;
    if (!filePath) return '未找到已下载的安装包';
    try {
      const stat = await fs.promises.stat(filePath);
      if (this.expectedSize > 0 && stat.size !== this.expectedSize) {
        return `安装包大小不符（期望 ${this.expectedSize} 字节，实际 ${stat.size} 字节）`;
      }
      if (this.expectedSha512) {
        const hash = crypto.createHash('sha512');
        await new Promise<void>((resolve, reject) => {
          const stream = fs.createReadStream(filePath);
          stream.on('data', (chunk) => hash.update(chunk));
          stream.on('end', () => resolve());
          stream.on('error', reject);
        });
        const actual = hash.digest('hex').toLowerCase();
        if (actual !== this.expectedSha512.toLowerCase()) {
          return '安装包校验和不符（sha512 不匹配），文件可能已损坏或被篡改';
        }
      }
      return null;
    } catch (e) {
      return `安装包核验失败：${String((e as Error)?.message ?? e)}`;
    }
  }

  /** 将当前状态与下载进度写入配置（下载/安装进度落盘） */
  private persist(payload: UpdateStatusPayload): void {
    try {
      updateConfig({
        update: {
          state: payload.state,
          version: payload.version ?? '',
          percent: payload.percent ?? 0,
          transferred: payload.transferred ?? 0,
          total: payload.total ?? 0,
          source: payload.source ?? 'github',
          channel: this.channelKey,
          error: payload.error ?? '',
        },
      });
    } catch (e) {
      log.warn('[updater] 更新进度写入配置失败:', e);
    }
  }

  private persistIdleConfig(): void {
    try {
      updateConfig({
        update: { state: 'idle', version: '', percent: 0, transferred: 0, total: 0, source: 'github', channel: this.channelKey, error: '' },
      });
    } catch {
      /* ignore */
    }
  }

  /**
   * 按当前通道应用 electron-updater 参数。
   * 新版本方案（{base}-{N} 正式 / {base}-{N}.beta 测试）下，版本识别不再依赖
   * electron-updater 的 GitHub 频道循环（-N.beta 的 prerelease[0] 是数字，会被当自定义频道），
   * 候选由本项目已实现自行选定（check → fetchCandidates/pickCandidate → generic feed）。
   * 这里统一 channel='latest'（generic feed 取 latest.yml / latest-linux.yml；
   * 且 setter 自动开启 allowDowngrade，供 semver 门接受"编号更大但 semver 偏旧"的候选）。
   */
  private applyChannel(): void {
    const def = getChannelDef(this.channelKey);
    autoUpdater.allowPrerelease = def.allowPrerelease;
    autoUpdater.channel = 'latest';
    log.info(`[updater] 更新通道: ${def.label}（${def.key}，allowPrerelease=${def.allowPrerelease}）`);
  }

  /** 通道定义列表（UI 动态渲染；可扩展） */
  getChannels(): UpdateChannelDef[] {
    return UPDATE_CHANNELS;
  }

  /** 切换更新通道（校验 + 持久化 + 立即生效，下次检查生效） */
  setChannel(key: string): UpdateStatusPayload {
    if (!UPDATE_CHANNELS.some((c) => c.key === key)) {
      log.warn(`[updater] 未知更新通道: ${key}`);
      return this.buildPayload();
    }
    if (this.channelKey === key) return this.buildPayload();
    this.channelKey = key as UpdateChannelKey;
    this.applyChannel();
    try {
      updateConfig({ update: { channel: key } });
    } catch (e) {
      log.warn('[updater] 通道写入配置失败:', e);
    }
    this.emit();
    return this.buildPayload();
  }

  getState(): UpdateStatusPayload {
    return this.buildPayload();
  }

  /**
   * 测试用：覆盖当前识别到的版本号（影响 update:getState 与后续更新检查的比对）。
   * 传入非法版本时忽略并返回当前状态。
   */
  setTestVersion(version: string): UpdateStatusPayload {
    const v = semver.valid(version.trim());
    if (!v) {
      log.warn(`[updater] 无效测试版本号: ${version}`);
      return this.buildPayload();
    }
    this.currentVersion = v;
    try {
      // currentVersion 在类型声明中为 readonly，但运行时可直接赋值（测试工具用）
      (autoUpdater as unknown as { currentVersion: unknown }).currentVersion = semver.parse(v);
    } catch (e) {
      log.warn('[updater] 设置 autoUpdater.currentVersion 失败:', e);
    }
    log.info(`[updater] 测试版本号 → ${v}`);
    this.emit();
    return this.buildPayload();
  }

  /**
   * 项目版本序判定：candidate 是否为 current 的「新版本」。
   * 见 compareVersionTags 的语义（base 相同 → 比构建号；beta/正式只是通道标记，不参与新旧）。
   */
  private isNewerCandidate(current: string, candidate: string): boolean {
    return compareVersionTags(candidate, current) > 0;
  }

  /**
   * 复核 electron-updater 的"新版本"判定并修正状态：
   * electron-updater 用纯 semver（AppUpdater.isUpdateAvailable → semver.gt），
   * 而 semver 规定同 base 下字母标识 > 数字标识 → v1.2.5-17 会把 v1.2.5-beta.16
   * 误判为新版本。按项目版本序复核：候选版本并非更新 → 状态回退为 not-available。
   */
  private correctAvailability(): void {
    if (this.state !== 'available' || !this.version) return;
    if (this.isNewerCandidate(this.currentVersion, this.version)) return;
    log.warn(`[updater] ${this.version} 不是 ${this.currentVersion} 的新版本（项目版本序，忽略 beta 通道标记），回退为无更新`);
    this.state = 'not-available';
    this.version = undefined;
    this.error = undefined;
    this.emit();
  }

  /** 版本比对（semver 规则，支持 v 前缀与 prerelease） */
  compareVersions(a: string, b: string): { a: string; b: string; result: string; detail: string } {
    const va = semver.valid(a.trim());
    const vb = semver.valid(b.trim());
    if (!va || !vb) {
      return {
        a: a.trim(),
        b: b.trim(),
        result: 'invalid',
        detail: `无效版本：${!va ? `「${a.trim()}」` : ''}${!va && !vb ? ' / ' : ''}${!vb ? `「${b.trim()}」` : ''}`,
      };
    }
    const c = semver.compare(va, vb);
    return {
      a: va,
      b: vb,
      result: c > 0 ? 'a>b' : c < 0 ? 'a<b' : 'a==b',
      detail: `${va} ${c > 0 ? '>' : c < 0 ? '<' : '=='} ${vb}`,
    };
  }

  /**
   * 检查更新（版本方案：{base}-{N} 正式 / {base}-{N}.beta 测试 / 旧 -beta.{N} 屏蔽）：
   * 1. 按来源依次（GitHub 官方 → 各加速源）抓取 release 候选；
   * 2. 按通道（woker=仅正式 / runner=正式+新测试版）过滤并剔除旧格式；
   * 3. 按项目版本序挑出"比当前新"的最新 tag → 指向该 tag 的 generic feed 走 electron-updater
   *    （下载/校验/安装链路复用）；版本序复核通过才判 available。
   * 不依赖 electron-updater 的 GitHub 频道循环（新格式 -N.beta 会被其当作自定义频道）。
   */
  async check(manual = false): Promise<UpdateStatusPayload> {
    if (!this.ready) return this.buildPayload();
    if (['downloading', 'paused', 'downloaded', 'installing'].includes(this.state)) {
      return this.buildPayload(); // 已有更新在进行中/已完成
    }

    this.manual = manual;
    this.suppressErrors = true;
    const allowPrerelease = getChannelDef(this.channelKey).allowPrerelease;
    this.state = 'checking';
    this.emit();

    const sources: { label: string; base: string }[] = [
      { label: 'github', base: '' },
      ...getMirrors().map((m) => ({ label: m, base: `${m}/` })),
    ];

    for (const { label, base } of sources) {
      try {
        const candidates = await this.fetchCandidates(base);
        const tag = this.pickCandidate(candidates, allowPrerelease);
        if (!tag) {
          log.info(`[updater] ${label}: 无符合条件的更新候选（通道/格式/版本序）`);
          continue; // 该源没有更新，尝试下一个源
        }
        const feedUrl = `${base}https://github.com/${OWNER}/${REPO}/releases/download/${tag}/`;
        log.info(`[updater] 检查源 ${label}，命中 ${tag} (feed: ${feedUrl})`);
        autoUpdater.setFeedURL({ provider: 'generic', url: feedUrl });
        // generic feed 取 latest.yml / latest-linux.yml；channel='latest' 同时开启 allowDowngrade，
        // 使 semver 门接受"编号更大但 semver 判定偏旧"的候选（如旧 -beta.N 当前 → 新格式）
        autoUpdater.allowPrerelease = allowPrerelease;
        autoUpdater.channel = 'latest';
        this.source = label;
        this.state = 'checking';
        this.emit();
        await autoUpdater.checkForUpdates();
        // 项目版本序复核：候选确为更新才保留 available
        this.correctAvailability();
        const result = this.buildPayload();
        if (result.state !== 'not-available') {
          this.suppressErrors = false;
          return result;
        }
        log.warn(`[updater] ${label} 反馈无可用更新，尝试下一个源`);
      } catch (err) {
        log.warn(`[updater] 更新源 ${label} 检查失败: ${String((err as Error)?.message ?? err)}`);
      }
    }

    this.suppressErrors = false;
    this.state = 'error';
    this.error = '无法连接更新服务器（GitHub 与所有加速源均不可用），请稍后重试';
    this.emit();
    return this.buildPayload();
  }

  /**
   * 抓取某来源的 release tag 候选列表：
   * base='' 为 GitHub 官方直连；否则 base=`${mirror}/`（加速源前缀，原样拼 https://）。
   * 组合：API 列表（含全部 release）+ /releases/latest 页面 HTML（兜底）。
   */
  private async fetchCandidates(base: string): Promise<string[]> {
    const candidates: string[] = [];
    const web = `${base}https://github.com/${OWNER}/${REPO}`;
    const api = `${base}https://api.github.com/repos/${OWNER}/${REPO}`;
    // 方式 1：/releases/latest 页面（最新非 prerelease release 的 tag，HTML 正则兜底）
    try {
      const res = await fetch(`${web}/releases/latest`, {
        headers: { 'User-Agent': 'koring-launcher-updater' },
        signal: AbortSignal.timeout(DISCOVER_TIMEOUT_MS),
      });
      if (res.ok) {
        const html = await res.text();
        const m = html.match(/\/releases\/tag\/(v[^"<]+)/);
        if (m?.[1]) candidates.push(m[1]);
      }
    } catch {
      /* 尝试下一种方式 */
    }
    // 方式 2：GitHub API release 列表
    try {
      const res = await fetch(`${api}/releases?per_page=40`, {
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'koring-launcher-updater' },
        signal: AbortSignal.timeout(DISCOVER_TIMEOUT_MS),
      });
      if (res.ok) {
        const releases: { draft?: boolean; tag_name?: string }[] = await res.json();
        for (const r of releases ?? []) {
          if (r.draft || !r.tag_name) continue;
          candidates.push(r.tag_name);
        }
      }
    } catch {
      /* ignore */
    }
    return candidates;
  }

  /** 从候选里挑出允许当前通道、且按项目版本序比当前更新的最新 tag；没有返回 null */
  private pickCandidate(candidates: string[], allowPrerelease: boolean): string | null {
    const allowed = candidates
      .filter((c) => isCandidateAllowed(c, allowPrerelease))
      .filter((c) => compareVersionTags(c, this.currentVersion) > 0);
    if (allowed.length === 0) return null;
    allowed.sort(compareVersionTags);
    return allowed[allowed.length - 1];
  }

  /** 不限当前版本：返回某来源允许通道/格式的最新 tag（发布说明回退用）；没有返回 null */
  private async fetchBestCandidate(base: string, allowPrerelease: boolean): Promise<string | null> {
    const candidates = await this.fetchCandidates(base);
    const allowed = candidates.filter((c) => isCandidateAllowed(c, allowPrerelease));
    if (allowed.length === 0) return null;
    allowed.sort(compareVersionTags);
    return allowed[allowed.length - 1];
  }

  /**
   * 获取指定版本（默认当前安装版本）的发布说明（release-notes.md 附件，原始 Markdown）。
   * GitHub 直连优先，失败后依次尝试加速源；当前版本没有发布说明时回退到最新版本。
   */
  async getReleaseNotes(requestedTag?: string): Promise<ReleaseNotesResult | null> {
    const tag = (requestedTag?.trim() || `v${app.getVersion()}`).replace(/^v(?=\d)/, 'v');
    const found = await this.fetchNotesForTag(tag);
    if (found) return found;

    // 回退：最新版本（发现 tag 后取发布说明）
    for (const mirror of getMirrors()) {
      const latestTag = await this.fetchBestCandidate(`${mirror}/`, true);
      if (latestTag && latestTag !== tag) {
        const foundLatest = await this.fetchNotesForTag(latestTag);
        if (foundLatest) {
          return { ...foundLatest, isLatest: true };
        }
      }
    }
    return null;
  }

  private async fetchNotesForTag(tag: string): Promise<ReleaseNotesResult | null> {
    const bases: { source: string; base: string }[] = [
      { source: 'github', base: `https://github.com/${OWNER}/${REPO}` },
      ...getMirrors().map((m) => ({ source: m, base: `${m}/https://github.com/${OWNER}/${REPO}` })),
    ];
    for (const { source, base } of bases) {
      try {
        const url = `${base}/releases/download/${tag}/release-notes.md`;
        const res = await fetch(url, {
          headers: { 'User-Agent': 'koring-launcher-updater' },
          signal: AbortSignal.timeout(DISCOVER_TIMEOUT_MS),
        });
        if (res.ok) {
          // 部分加速源对任意 URL 返回 200 + HTML 跳转/拦截页，必须校验内容
          const contentType = res.headers.get('content-type') ?? '';
          if (/^text\/html/i.test(contentType)) continue;
          const notes = await res.text();
          if (!notes.trim()) continue;
          if (/^\s*<!doctype html/i.test(notes) || /^\s*<html[\s>]/i.test(notes)) continue;
          log.info(`[updater] 发布说明来源: ${source} (${tag})`);
          return { tag, version: tag.replace(/^v/, ''), notes, source, isLatest: false };
        }
      } catch {
        /* 尝试下一个源 */
      }
    }
    return null;
  }

  /**
   * 下载更新（触发下载，进度经 update:status 上报并写入配置）。
   * available → 开始下载；paused → 继续下载。
   */
  async download(): Promise<void> {
    if (!this.ready) return;
    if (this.state === 'downloading' || this.state === 'downloaded' || this.state === 'installing') return;
    // 非"可用/已暂停"状态直接忽略（防陈旧 updateInfoAndProvider 被误用）
    if (this.state !== 'available' && this.state !== 'paused') return;
    // 复核目标版本确为当前版本的新版本（项目版本序），否则回退为无更新
    if (this.state === 'available' && this.version && !this.isNewerCandidate(this.currentVersion, this.version)) {
      log.warn(`[updater] 下载被拒：${this.version} 不是 ${this.currentVersion} 的新版本`);
      this.state = 'not-available';
      this.version = undefined;
      this.emit();
      return;
    }
    if (this.state === 'paused') {
      // 继续下载（可能从断点续传，也可能重新开始，取决于 electron-updater 缓存）
      log.info('[updater] 继续下载');
    }
    this.state = 'downloading';
    this.progress = null;
    this.emit();

    const token = new CancellationToken();
    this.downloadToken = token;
    try {
      await autoUpdater.downloadUpdate(token);
    } catch (err) {
      if (token.cancelled) return; // 主动暂停/取消，不是错误
      this.state = 'error';
      this.error = String((err as Error)?.message ?? err);
      this.emit();
    }
  }

  /** 暂停下载（中断当前请求，保留进度；再次下载即继续） */
  pause(): void {
    if (!this.ready || this.state !== 'downloading') return;
    this.state = 'paused';
    this.emit();
    this.downloadToken?.cancel();
  }

  /** 取消下载：中断并清除进度，回到 available（可重新下载） */
  cancel(): void {
    if (!this.ready) return;
    this.downloadToken?.cancel();
    this.downloadToken = null;
    if (this.state === 'downloading' || this.state === 'paused') {
      this.state = 'available';
      this.progress = null;
      this.emit();
    }
  }

  /**
   * 退出并安装（NSIS 静默安装，安装完成自动重启）。
   * 安装状态先写入配置并立即落盘，避免退出时 debounce 未写盘。
   * 安装包未通过核验（verified=false）时先弹确认框：
   *   继续安装 / 取消并删除安装包 —— 绝不静默安装校验异常的文件。
   */
  async quitAndInstall(): Promise<void> {
    if (!this.ready || this.state !== 'downloaded') return;

    if (!this.verified) {
      const { dialog, BrowserWindow } = electron;
      const parent = BrowserWindow.getAllWindows().find((w) => w.isVisible()) ?? null;
      const opts: electron.MessageBoxOptions = {
        type: 'warning',
        title: '版本校验异常',
        message: '请注意，版本校验异常，可能是文件损坏或者被替换，因此您会看到此弹窗，您可以选择继续安装或取消并删除安装包',
        detail: this.error ? `核验详情：${this.error}` : '核验详情：sha512 校验和与发布记录不一致',
        buttons: ['继续安装', '取消并删除安装包'],
        defaultId: 1,
        cancelId: 1,
        noLink: true,
      };
      const { response } = parent
        ? await dialog.showMessageBox(parent, opts)
        : await dialog.showMessageBox(opts);
      if (response !== 0) {
        // 取消并删除安装包
        log.warn('[updater] 用户取消安装并删除校验异常包');
        await this.removeDownloadedPackage().catch((e) => log.warn('[updater] 删除安装包失败:', e));
        this.state = 'idle';
        this.version = undefined;
        this.error = undefined;
        this.verified = false;
        this.emit();
        return;
      }
      log.warn('[updater] 用户确认继续安装（校验异常但已确认）');
    }

    this.state = 'installing';
    this.emit();
    try {
      flushConfig();
    } catch {
      /* ignore */
    }
    // 静默安装（/S）+ 安装完成后自动重启（--force-run）
    autoUpdater.quitAndInstall(true, true);
  }

  /** 删除已下载（校验失败）的安装包 */
  private async removeDownloadedPackage(): Promise<void> {
    const helper = (autoUpdater as unknown as { downloadedUpdateHelper?: { file?: string } }).downloadedUpdateHelper;
    const filePath = helper?.file;
    if (!filePath) return;
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
      log.info(`[updater] 已删除安装包: ${filePath}`);
    }
  }

  /** 获取系统下载临时目录（用于清理提示，暂未启用） */
  getCacheDir(): string {
    return os.tmpdir();
  }
}

export const updateService = new UpdateService();
