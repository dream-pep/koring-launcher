import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { type ScannedVersion, scanGameDirectories } from './version-scan';

/**
 * 游戏文件夹识别（参考 PCL2 的「选择文件夹即自动识别」思路）。
 *
 * 纯逻辑模块：不 import electron / @xmcl，可在纯 node 下直接单测。
 * 只做只读探测：existsSync / readdirSync / 读取版本 JSON 的少量字段。
 */

export type GameFolderKind = 'game-root' | 'versions-dir' | 'version-dir' | 'instance' | 'unknown';
export type LauncherKind = 'koring' | 'official' | 'pcl' | 'hmcl' | 'prism' | 'multimc' | 'unknown';

export interface VersionSummary {
  total: number;
  healthy: number;
  broken: number;
  loaders: Record<string, number>;
}

export interface GameFolderInfo {
  /** 用户选择的原始路径 */
  inputPath: string;
  /** 归一化后的游戏根目录（含 versions/） */
  rootPath: string;
  kind: GameFolderKind;
  launcher: LauncherKind;
  launcherHints: string[];
  hasVersions: boolean;
  hasLibraries: boolean;
  hasAssets: boolean;
  versionCount: number;
  healthyCount: number;
  versions: ScannedVersion[];
  summary: VersionSummary;
  warnings: string[];
}

export interface GameFolderCandidate {
  path: string;
  label: string;
  launcher: LauncherKind;
  versionCount: number;
  healthyCount: number;
}

export interface DiscoveryResult {
  candidates: GameFolderCandidate[];
  scanned: number;
}

function exists(target: string): boolean {
  try {
    return fs.existsSync(target);
  } catch {
    return false;
  }
}

function isDirectory(target: string): boolean {
  try {
    return fs.statSync(target).isDirectory();
  } catch {
    return false;
  }
}

function normalizeForCompare(target: string): string {
  const resolved = path.resolve(target).replace(/[\\/]+$/, '');
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

/** 探测启动器特征文件 */
export function detectLauncher(rootPath: string): { launcher: LauncherKind; hints: string[] } {
  const hints: string[] = [];
  const has = (relative: string) => {
    if (exists(path.join(rootPath, relative))) {
      hints.push(relative);
      return true;
    }
    return false;
  };

  let kind: LauncherKind = 'unknown';

  if (has('instance.json') || (isDirectory(path.join(rootPath, 'instances')) && has('Koring.yml'))) {
    kind = 'koring';
  }
  if (kind === 'unknown' && has('PCL.ini')) kind = 'pcl';
  if (kind === 'unknown' && has('.hmcl.json')) kind = 'hmcl';
  if (kind === 'unknown' && has('prismlauncher.cfg')) kind = 'prism';
  if (kind === 'unknown' && has('multimc.cfg')) kind = 'multimc';
  if (kind === 'unknown' && (has('launcher_profiles.json') || has('launcher_accounts.json'))) {
    kind = 'official';
  }

  return { launcher: kind, hints };
}

/**
 * 把用户/自动发现给出的任意层级路径归一化成游戏根：
 * - `<root>`（直接含 versions/）
 * - `<root>/versions` → `<root>`
 * - `<root>/versions/<id>` → `<root>`
 * - `<root>/instances/<name>`（Koring 实例目录）→ `<root>`
 */
export function normalizeGameFolder(inputPath: string): { rootPath: string; kind: GameFolderKind; warnings: string[] } {
  const warnings: string[] = [];
  const resolved = path.resolve(inputPath);

  if (!isDirectory(resolved)) {
    return { rootPath: resolved, kind: 'unknown', warnings: ['目录不存在或不可访问'] };
  }

  // Koring 实例目录：<root>/instances/<name>
  if (exists(path.join(resolved, 'instance.json'))) {
    const parent = path.dirname(resolved);
    if (path.basename(parent) === 'instances') {
      const root = path.dirname(parent);
      warnings.push(`识别为启动器实例目录，已自动使用其游戏根目录：${root}`);
      return { rootPath: root, kind: 'instance', warnings };
    }
    warnings.push('识别为实例目录（未处于 instances/ 下），已按实例自身目录处理');
    return { rootPath: resolved, kind: 'instance', warnings };
  }

  // 版本目录：<root>/versions/<id> 只含 <id>.json
  const name = path.basename(resolved);
  const parent = path.dirname(resolved);
  if (exists(path.join(resolved, `${name}.json`)) && path.basename(parent).toLowerCase() === 'versions') {
    const root = path.dirname(parent);
    warnings.push(`识别为单个版本目录，已自动使用其游戏根目录：${root}`);
    return { rootPath: root, kind: 'version-dir', warnings };
  }

  // 直接选中了 versions 目录
  if (name.toLowerCase() === 'versions') {
    const root = path.dirname(resolved);
    warnings.push(`识别为 versions 目录，已自动使用其父目录：${root}`);
    return { rootPath: root, kind: 'versions-dir', warnings };
  }

  // 直接就是游戏根
  if (isDirectory(path.join(resolved, 'versions'))) {
    return { rootPath: resolved, kind: 'game-root', warnings };
  }

  // 官方启动器风格：只有 launcher_profiles.json，没有 versions/
  if (exists(path.join(resolved, 'launcher_profiles.json'))) {
    warnings.push('该目录看起来是 Minecraft 主目录，但还没有 versions 目录');
    return { rootPath: resolved, kind: 'game-root', warnings };
  }

  return { rootPath: resolved, kind: 'unknown', warnings: ['未在该目录中识别到 versions 目录或启动器特征文件'] };
}

function summarize(versions: ScannedVersion[]): VersionSummary {
  const summary: VersionSummary = { total: versions.length, healthy: 0, broken: 0, loaders: {} };
  for (const version of versions) {
    if (version.healthy) summary.healthy += 1;
    else summary.broken += 1;
    for (const loader of version.loaders) {
      summary.loaders[loader] = (summary.loaders[loader] || 0) + 1;
    }
  }
  return summary;
}

export function inspectGameFolder(inputPath: string, limit = 500): GameFolderInfo {
  const { rootPath, kind, warnings } = normalizeGameFolder(inputPath);
  const versions = kind === 'instance' && !isDirectory(path.join(rootPath, 'versions')) ? [] : scanGameDirectories(rootPath, limit);
  const { launcher, hints } = detectLauncher(rootPath);
  const summary = summarize(versions);

  if (kind === 'unknown' && !versions.length) {
    // 保留既有告警，避免重复
  } else if (versions.length === 0) {
    warnings.push('该目录下没有找到任何版本，可能尚未安装游戏');
  }

  return {
    inputPath,
    rootPath,
    kind,
    launcher,
    launcherHints: hints,
    hasVersions: isDirectory(path.join(rootPath, 'versions')),
    hasLibraries: isDirectory(path.join(rootPath, 'libraries')),
    hasAssets: isDirectory(path.join(rootPath, 'assets')),
    versionCount: versions.length,
    healthyCount: summary.healthy,
    versions,
    summary,
    warnings,
  };
}

/** 常见固定位置（不扫全盘）：默认目录 + 常见启动器目录 + 各磁盘根目录下的 .minecraft / minecraft */
export function commonGameFolderPaths(): string[] {
  const candidates: string[] = [];
  const home = os.homedir();
  const appData = process.env.APPDATA;
  const localAppData = process.env.LOCALAPPDATA;

  const push = (target?: string) => {
    if (target) candidates.push(target);
  };

  if (process.platform === 'win32') {
    push(appData && path.join(appData, '.minecraft'));
    push(localAppData && path.join(localAppData, '.minecraft'));
    push(path.join(home, '.minecraft'));
    push(path.join(home, 'Documents', 'minecraft'));
    push(path.join(home, 'Desktop', 'minecraft'));
    push(appData && path.join(appData, 'PrismLauncher'));
    push(appData && path.join(appData, 'MultiMC'));
    push(appData && path.join(appData, 'PCL'));
    push(appData && path.join(appData, 'HMCL'));
    for (const drive of 'CDEFGHIJ'.split('')) {
      push(`${drive}:\\minecraft`);
      push(`${drive}:\\.minecraft`);
    }
  } else if (process.platform === 'darwin') {
    push(path.join(home, 'Library', 'Application Support', 'minecraft'));
    push(path.join(home, '.minecraft'));
    push(path.join(home, 'Library', 'Application Support', 'PrismLauncher'));
  } else {
    push(path.join(home, '.minecraft'));
    push(path.join(home, '.local', 'share', 'PrismLauncher'));
    push(path.join(home, '.var', 'app', 'com.mojang.Minecraft', '.minecraft'));
  }

  return candidates;
}

/**
 * 在常见位置中发现可用的游戏目录（去重 + 过滤空目录）。
 * extraCandidates 用于把配置里已记录的目录、启动器自身目录一并纳入检查。
 */
export function discoverGameFolders(extraCandidates: string[] = []): DiscoveryResult {
  const probeList = [...commonGameFolderPaths(), ...extraCandidates];
  const seen = new Set<string>();
  const candidates: GameFolderCandidate[] = [];
  let scanned = 0;

  for (const probe of probeList) {
    if (!probe || !isDirectory(probe)) continue;
    scanned += 1;
    const { rootPath } = normalizeGameFolder(probe);
    const key = normalizeForCompare(rootPath);
    if (seen.has(key)) continue;
    seen.add(key);

    const info = inspectGameFolder(rootPath, 500);
    if (info.versionCount === 0 && info.launcher === 'unknown') continue;

    candidates.push({
      path: rootPath,
      label: buildCandidateLabel(info),
      launcher: info.launcher,
      versionCount: info.versionCount,
      healthyCount: info.healthyCount,
    });
  }

  candidates.sort((a, b) => b.healthyCount - a.healthyCount || b.versionCount - a.versionCount);
  return { candidates, scanned };
}

function buildCandidateLabel(info: GameFolderInfo): string {
  const launcherLabel: Record<LauncherKind, string> = {
    koring: 'Koring 启动器',
    official: '官方启动器',
    pcl: 'PCL2',
    hmcl: 'HMCL',
    prism: 'Prism Launcher',
    multimc: 'MultiMC',
    unknown: 'Minecraft 目录',
  };
  return `${launcherLabel[info.launcher]} · ${info.versionCount} 个版本`;
}
