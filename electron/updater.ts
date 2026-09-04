import { autoUpdater, CancellationToken, type ProgressInfo } from 'electron-updater';
import electron from 'electron';
import * as os from 'os';
import semver from 'semver';
import { getConfig, updateConfig, flushConfig } from './config';

const { app } = electron;

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

/**
 * 项目版本序：比较两个版本 tag（如 v1.2.5-17 / v1.2.5-beta.16 / v1.2.0-2608271921），返回 a - b。
 *
 * 语义（与 electron-updater 的纯 semver 不同，专为本项目版本方案定制）：
 * 每个 release = {base, 构建号}。beta.N 与 N 的 **beta/正式只是通道标记，不参与新旧排序**：
 * - base（X.Y.Z）不同 → 按 base 数值比较（优先）
 * - base 相同 → 按构建号（数字部分，忽略 beta 前缀）比较
 * - 无构建号（如 1.2.5，旧版正式格式）→ 构建号视为 -1（同 base 内最旧，可被后续带尾号版本覆盖）
 * - 构建号相同（如 beta.17 与 17）→ 视为相等（通道标记不参与排序；同号跨通道版本实际不会共存）
 *
 * 修复目标：v1.2.5-17（构建 17）不应把 v1.2.5-beta.16（构建 16）当新版本；
 * 但 v1.2.5-beta.18（构建 18）对 v1.2.5-17 是新版本。
 */
function compareVersionTags(a: string, b: string): number {
  const parse = (t: string): { base: number[]; num: number } => {
    const s = t.replace(/^v/i, '');
    const [base, buildStr = ''] = s.split('-');
    const nums = base.split('.').map((n) => parseInt(n, 10) || 0);
    while (nums.length < 3) nums.push(0);
    if (buildStr === '') {
      // 无构建号（旧版正式格式）：同 base 内视为最旧
      return { base: nums, num: -1 };
    }
    const beta = /^beta\.(\d+)$/i.exec(buildStr);
    const num = parseInt(beta ? beta[1] : buildStr, 10);
    return { base: nums, num: Number.isFinite(num) ? num : 0 };
  };
  const pa = parse(a);
  const pb = parse(b);
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
  /** 当前更新通道（woker 慢走 / runner 跑步；从配置读取，可运行时切换） */
  private channelKey: UpdateChannelKey = 'woker';

  init(listener: (payload: UpdateStatusPayload) => void): void {
    this.listener = listener;
    this.currentVersion = app.getVersion();

    if (!app.isPackaged) {
      console.log('[updater] 开发模式：跳过自动更新');
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
      console.log(`[updater] 上次更新状态 ${persisted.state} (v${persisted.version})，已重置`);
      this.persistIdleConfig();
    }

    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
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
      this.emit();
    });
    autoUpdater.on('update-not-available', () => {
      this.state = 'not-available';
      this.version = undefined;
      this.emit();
    });
    autoUpdater.on('download-progress', (p) => {
      this.state = 'downloading';
      this.progress = p;
      this.emit();
    });
    autoUpdater.on('update-downloaded', (info) => {
      this.state = 'downloaded';
      this.version = info.version;
      this.emit();
    });
    autoUpdater.on('error', (err: Error) => {
      const message = String(err?.message ?? err);
      console.warn(`[updater] electron-updater error: ${message}`);
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
      error: this.error,
    };
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
      console.warn('[updater] 更新进度写入配置失败:', e);
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

  /** 按当前通道应用 electron-updater 的 allowPrerelease + 频道（woker=只收正式版 / runner=可收预览版） */
  private applyChannel(): void {
    const def = getChannelDef(this.channelKey);
    // runner(跑步) 强制开启 allowPrerelease → GitHub provider 走 Atom feed 频道逻辑可收 beta；
    // woker(慢走) 关闭 → 走 releases/latest 只认稳定版，不被预览版污染。
    autoUpdater.allowPrerelease = def.allowPrerelease;
    if (def.allowPrerelease) {
      // 关键：runner 显式指定频道 "beta"。否则当当前版本是数字尾号稳定版（如 1.2.5-13）时，
      // semver.prerelease(currentVersion)[0] = "13" 会被 GitHub provider 当作"自定义频道"，
      // 通道循环匹配不到任何版本 → "No published versions on GitHub"，
      // 正式版切跑步模式将无法检测 beta 预览版。
      autoUpdater.channel = 'beta';
    } else {
      // woker 恢复默认 latest 频道（allowPrerelease=false 走 /releases/latest，频道不影响识别）
      autoUpdater.channel = 'latest';
    }
    console.log(`[updater] 更新通道: ${def.label}（${def.key}，allowPrerelease=${def.allowPrerelease}，channel=${autoUpdater.channel}）`);
  }

  /** 通道定义列表（UI 动态渲染；可扩展） */
  getChannels(): UpdateChannelDef[] {
    return UPDATE_CHANNELS;
  }

  /** 切换更新通道（校验 + 持久化 + 立即生效，下次检查生效） */
  setChannel(key: string): UpdateStatusPayload {
    if (!UPDATE_CHANNELS.some((c) => c.key === key)) {
      console.warn(`[updater] 未知更新通道: ${key}`);
      return this.buildPayload();
    }
    if (this.channelKey === key) return this.buildPayload();
    this.channelKey = key as UpdateChannelKey;
    this.applyChannel();
    try {
      updateConfig({ update: { channel: key } });
    } catch (e) {
      console.warn('[updater] 通道写入配置失败:', e);
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
      console.warn(`[updater] 无效测试版本号: ${version}`);
      return this.buildPayload();
    }
    this.currentVersion = v;
    try {
      // currentVersion 在类型声明中为 readonly，但运行时可直接赋值（测试工具用）
      (autoUpdater as unknown as { currentVersion: unknown }).currentVersion = semver.parse(v);
    } catch (e) {
      console.warn('[updater] 设置 autoUpdater.currentVersion 失败:', e);
    }
    console.log(`[updater] 测试版本号 → ${v}`);
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
    console.warn(`[updater] ${this.version} 不是 ${this.currentVersion} 的新版本（项目版本序，忽略 beta 通道标记），回退为无更新`);
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
   * 检查更新：GitHub 官方优先，失败后依次尝试加速源。
   */
  async check(manual = false): Promise<UpdateStatusPayload> {
    if (!this.ready) return this.buildPayload();
    if (['downloading', 'paused', 'downloaded', 'installing'].includes(this.state)) {
      return this.buildPayload(); // 已有更新在进行中/已完成
    }

    this.manual = manual;
    this.suppressErrors = true;

    // 1) GitHub 官方（app-update.yml 内置 github provider）
    this.source = 'github';
    this.state = 'checking';
    this.emit();
    try {
      await autoUpdater.checkForUpdates();
      this.suppressErrors = false;
      // 复核 electron-updater 的纯 semver 判定（v1.2.5-17 误判 v1.2.5-beta.16 为新版本）
      this.correctAvailability();
      return this.buildPayload();
    } catch (err) {
      console.warn(`[updater] GitHub 官方更新源不可用: ${String((err as Error)?.message ?? err)}`);
    }

    // 2) 加速源兜底：镜像页面发现最新 tag → generic feed → 检查
    for (const mirror of getMirrors()) {
      try {
        const tag = await this.discoverLatestTag(mirror);
        if (!tag) {
          console.warn(`[updater] ${mirror} 无法发现最新版本，跳过`);
          continue;
        }
        const feedUrl = `${mirror}/https://github.com/${OWNER}/${REPO}/releases/download/${tag}/`;
        console.log(`[updater] 切换加速源: ${mirror} (feed: ${feedUrl})`);
        autoUpdater.setFeedURL({ provider: 'generic', url: feedUrl });
        this.source = mirror;
        this.state = 'checking';
        this.emit();
        await autoUpdater.checkForUpdates();
        this.suppressErrors = false;
        // 复核 electron-updater 的纯 semver 判定
        this.correctAvailability();
        // 镜像若反馈无更新（可能发现的是旧 tag / latest.yml 不匹配），
        // 不要就此返回 not-available，继续尝试下一个源
        const mirrorResult = this.buildPayload();
        if (mirrorResult.state !== 'not-available') return mirrorResult;
        console.warn(`[updater] ${mirror} 反馈无可用更新，尝试下一个源`);
      } catch (err) {
        console.warn(`[updater] 加速源 ${mirror} 检查失败: ${String((err as Error)?.message ?? err)}`);
      }
    }

    this.suppressErrors = false;
    this.state = 'error';
    this.error = '无法连接更新服务器（GitHub 与所有加速源均不可用），请稍后重试';
    this.emit();
    return this.buildPayload();
  }

  /**
   * 通过加速源发现最新 release tag：
   * 1) /releases/latest 页面 HTML 中提取 tag（多数下载型加速源可代理该页面；
   *    ⚠️ 该页面只指向最新「非 prerelease」release，本项目所有版本都是 prerelease 形式，结果可能偏旧）
   * 2) GitHub API（经加速源代理，列表含 prerelease），作为备选
   * 最终取两种方式候选集中版本最大者（buildId 数值比较），避免旧 tag 覆盖新 prerelease。
   */
  private async discoverLatestTag(mirror: string): Promise<string | null> {
    const candidates: string[] = [];

    // 方式 1：HTML 页面
    try {
      const pageUrl = `${mirror}/https://github.com/${OWNER}/${REPO}/releases/latest`;
      const res = await fetch(pageUrl, {
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

    // 方式 2：GitHub API（经加速源代理）
    try {
      const apiUrl = `${mirror}/https://api.github.com/repos/${OWNER}/${REPO}/releases?per_page=20`;
      const res = await fetch(apiUrl, {
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'koring-launcher-updater' },
        signal: AbortSignal.timeout(DISCOVER_TIMEOUT_MS),
      });
      if (res.ok) {
        const releases: { draft?: boolean; prerelease?: boolean; tag_name?: string }[] = await res.json();
        const allowPrerelease = getChannelDef(this.channelKey).allowPrerelease;
        for (const r of releases ?? []) {
          // draft 一律跳过；woker（只收正式版）跳过 GitHub 标记为 prerelease 的 release
          if (r.draft || (!allowPrerelease && r.prerelease)) continue;
          if (r.tag_name) candidates.push(r.tag_name);
        }
      }
    } catch {
      /* ignore */
    }

    if (candidates.length === 0) return null;
    candidates.sort(compareVersionTags);
    const latest = candidates[candidates.length - 1];
    if (candidates.length > 1) {
      console.log(`[updater] ${mirror} 候选版本: ${candidates.join(', ')} → 取 ${latest}`);
    }
    return latest;
  }

  /**
   * 获取指定版本（默认当前安装版本）的发布说明（release-notes.md 附件，原始 Markdown）。
   * GitHub 直连优先，失败后依次尝试加速源；当前版本没有发布说明时回退到最新版本。
   */
  async getReleaseNotes(requestedTag?: string): Promise<ReleaseNotesResult | null> {
    const tag = (requestedTag?.trim() || `v${app.getVersion()}`).replace(/^v(?=\d)/, 'v');
    const found = await this.fetchNotesForTag(tag);
    if (found) return found;

    // 回退：最新版本（通过 /releases/latest 页面发现 tag）
    for (const mirror of getMirrors()) {
      const latestTag = await this.discoverLatestTag(mirror);
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
          console.log(`[updater] 发布说明来源: ${source} (${tag})`);
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
      console.warn(`[updater] 下载被拒：${this.version} 不是 ${this.currentVersion} 的新版本`);
      this.state = 'not-available';
      this.version = undefined;
      this.emit();
      return;
    }
    if (this.state === 'paused') {
      // 继续下载（可能从断点续传，也可能重新开始，取决于 electron-updater 缓存）
      console.log('[updater] 继续下载');
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
   */
  quitAndInstall(): void {
    if (!this.ready || this.state !== 'downloaded') return;
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

  /** 获取系统下载临时目录（用于清理提示，暂未启用） */
  getCacheDir(): string {
    return os.tmpdir();
  }
}

export const updateService = new UpdateService();
