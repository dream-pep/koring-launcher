import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import {
  LOADER_LABELS,
  type LoaderKey,
  type VersionChain,
  type VersionJsonLite,
  readVersionChain,
  readVersionJson,
} from './version-scan';

/**
 * 启动目标解析（纯逻辑，不 import electron / @xmcl）。
 *
 * 解决两个真实缺陷：
 * 1. 实例目录里的 versions/ 只有加载器版本（Forge/Fabric/...）时，原版版本 id 并不存在，
 *    直接 `Version.parse(instancePath, runtime.minecraft)` 必然失败；
 * 2. 启动时 resourcePath 默认等于 gamePath，实例目录没有 libraries/assets 时无法启动。
 *
 * 这里用「资源根（resourceRoot，管 versions/libraries/assets）+ 游戏根（gameRoot，管 saves/mods/logs）」
 * 二元模型把两者分开，并按加载器特征挑选真正可启动的版本 id。
 */

export interface InstanceRuntimeSpec {
  minecraft: string;
  forge?: string;
  neoForged?: string;
  fabricLoader?: string;
  quiltLoader?: string;
  optifine?: string;
}

export interface LaunchRootsInput {
  instancePath: string;
  runtime: InstanceRuntimeSpec;
  /** 实例自定义资源根（含 versions/libraries/assets） */
  resourcePath?: string;
  /** 全局共享资源目录（自动发现/引用式导入时写入） */
  sharedResourceDir?: string;
}

export interface LaunchRoots {
  /** 提供 versions / libraries / assets 的目录（传给 xmcl 的 resourcePath） */
  resourceRoot: string;
  /** 提供 --gameDir / saves / mods 的目录 */
  gameRoot: string;
  source: 'instance-custom' | 'instance' | 'shared';
}

/**
 * 版本隔离档位（与 electron/config.ts 的 `game.isolation` 同义，PCL2 三档）：
 * - `instance`：运行数据隔离在实例目录（默认）；
 * - `version`：运行数据隔离到资源根的 `versions/<版本 id>/`；
 * - `none`：不隔离，运行数据放在资源根目录（所有实例共用）。
 */
export type GameIsolation = 'instance' | 'version' | 'none';

/**
 * 计算运行数据目录（mods / saves / config / resourcepacks / screenshots / logs）。
 *
 * 与 `resolveLaunchRoots()` 的区别：这里只管「玩家数据落在哪」，
 * `resourceRoot` 永远提供 versions/libraries/assets，不参与隔离判定。
 */
export function resolveGameDataDir(input: {
  instancePath: string;
  isolation: GameIsolation;
  resourceRoot: string;
  /** 实际启动的版本 id（隔离到版本目录时用），缺省回落到实例目录 */
  versionId?: string;
}): string {
  if (input.isolation === 'none') return path.resolve(input.resourceRoot);
  if (input.isolation === 'version') {
    if (!input.versionId) return path.resolve(input.instancePath);
    return path.resolve(input.resourceRoot, 'versions', input.versionId);
  }
  return path.resolve(input.instancePath);
}

export type LaunchErrorCode =
  | 'INSTANCE_NOT_FOUND'
  | 'LAUNCH_VERSION_NOT_FOUND'
  | 'LAUNCH_VERSION_INCOMPLETE'
  | 'LAUNCH_DEPENDENCIES_MISSING';

export class LaunchError extends Error {
  code: LaunchErrorCode;
  detail?: Record<string, unknown>;

  constructor(code: LaunchErrorCode, message: string, detail?: Record<string, unknown>) {
    super(message);
    this.name = 'LaunchError';
    this.code = code;
    this.detail = detail;
  }
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

export function listVersionIds(versionsDir: string): string[] {
  if (!isDirectory(versionsDir)) return [];
  try {
    return fs
      .readdirSync(versionsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

/** 目录里是否存在至少一个「JSON + JAR 齐全」的版本 */
export function hasCompleteVersion(versionsDir: string): boolean {
  return listVersionIds(versionsDir).some(
    (id) => exists(path.join(versionsDir, id, `${id}.json`)) && exists(path.join(versionsDir, id, `${id}.jar`))
  );
}

function isResourceRoot(target: string): boolean {
  return isDirectory(path.join(target, 'versions'));
}

/**
 * 决定资源根与游戏根。
 * 优先实例自带 versions（自包含）；否则退回全局共享资源目录；两者都没有时仍返回实例目录，
 * 由后续的版本解析抛出可读错误。
 */
export function resolveLaunchRoots(input: LaunchRootsInput): LaunchRoots {
  const instancePath = path.resolve(input.instancePath);

  const custom = input.resourcePath?.trim();
  if (custom && isResourceRoot(custom)) {
    return { resourceRoot: path.resolve(custom), gameRoot: path.resolve(custom), source: 'instance-custom' };
  }

  const localVersions = path.join(instancePath, 'versions');
  if (isResourceRoot(instancePath) && (hasCompleteVersion(localVersions) || !input.sharedResourceDir)) {
    return { resourceRoot: instancePath, gameRoot: instancePath, source: 'instance' };
  }

  const shared = input.sharedResourceDir?.trim();
  if (shared && isResourceRoot(shared)) {
    // 共享资源目录只提供 versions/libraries/assets；saves/mods/logs 仍归实例自己，
    // 否则多个实例会共用同一份存档目录。
    return { resourceRoot: path.resolve(shared), gameRoot: instancePath, source: 'shared' };
  }

  return { resourceRoot: instancePath, gameRoot: instancePath, source: 'instance' };
}

export interface LoaderRequest {
  key: LoaderKey;
  label: string;
  version: string;
}

export function loaderRequests(runtime: InstanceRuntimeSpec): LoaderRequest[] {
  const keys: LoaderKey[] = ['forge', 'neoForged', 'fabricLoader', 'quiltLoader', 'optifine'];
  const requests: LoaderRequest[] = [];
  for (const key of keys) {
    const version = runtime[key];
    if (version) requests.push({ key, label: LOADER_LABELS[key], version });
  }
  return requests;
}

/** 版本号宽松匹配：Forge 的 maven 版本常带 mc 前缀（1.20.1-47.2.0），两边任一带前缀都算命中 */
export function versionMatches(requested: string, detected?: string): boolean {
  if (!detected) return true;
  if (requested === detected) return true;
  if (detected.endsWith(`-${requested}`)) return true;
  if (requested.endsWith(`-${detected}`)) return true;
  return false;
}

function chainSatisfies(chain: VersionChain, requests: LoaderRequest[]): boolean {
  return requests.every((request) => {
    const detected = chain.loaders[request.key];
    return Boolean(detected) && versionMatches(request.version, detected);
  });
}

export interface ResolvedLaunch {
  id: string;
  via: 'configured' | 'base' | 'loader' | 'fallback';
  rootId: string;
  chain: VersionChain;
  loaderLabels: string[];
  warnings: string[];
}

/**
 * 选出真正可启动的版本 id：
 * configured（实例显式指定且匹配） > base（无加载器时空版本 id） > loader（按加载器特征挑最新） > fallback（原样启动并告警）
 */
export function resolveLaunchVersionId(
  versionsDir: string,
  runtime: InstanceRuntimeSpec,
  preferred?: string
): ResolvedLaunch {
  const ids = listVersionIds(versionsDir);
  const requests = loaderRequests(runtime);
  const warnings: string[] = [];
  const preferredId = preferred?.trim();

  if (!requests.length) {
    const id = preferredId || runtime.minecraft;
    if (ids.includes(id)) {
      return {
        id,
        via: preferredId ? 'configured' : 'base',
        rootId: id,
        chain: readVersionChain(versionsDir, id),
        loaderLabels: [],
        warnings,
      };
    }
    if (ids.includes(runtime.minecraft)) {
      warnings.push(`指定启动版本 ${id} 不存在，已回退到 ${runtime.minecraft}`);
      return {
        id: runtime.minecraft,
        via: 'fallback',
        rootId: runtime.minecraft,
        chain: readVersionChain(versionsDir, runtime.minecraft),
        loaderLabels: [],
        warnings,
      };
    }
    throw new LaunchError('LAUNCH_VERSION_NOT_FOUND', `未找到版本「${id}」，该目录下没有可启动的版本文件。`, {
      versionsDir,
      requested: id,
      available: ids,
    });
  }

  if (preferredId && ids.includes(preferredId)) {
    const chain = readVersionChain(versionsDir, preferredId);
    if (chainSatisfies(chain, requests)) {
      return {
        id: preferredId,
        via: 'configured',
        rootId: chain.rootId,
        chain,
        loaderLabels: requests.map((r) => r.label),
        warnings,
      };
    }
    warnings.push(`指定启动版本 ${preferredId} 与实例记录的加载器不匹配，已忽略。`);
  }

  const candidates = ids
    .filter((id) => id !== preferredId)
    .map((id) => ({ id, chain: readVersionChain(versionsDir, id) }))
    .filter((entry) => entry.chain.rootId === runtime.minecraft && chainSatisfies(entry.chain, requests))
    .sort((a, b) => b.id.localeCompare(a.id, 'en', { numeric: true }));

  if (candidates.length) {
    if (candidates.length > 1) {
      warnings.push(`检测到 ${candidates.length} 个匹配的加载器版本，已选择 ${candidates[0].id}。`);
    }
    return {
      id: candidates[0].id,
      via: 'loader',
      rootId: candidates[0].chain.rootId,
      chain: candidates[0].chain,
      loaderLabels: requests.map((r) => r.label),
      warnings,
    };
  }

  if (ids.includes(runtime.minecraft)) {
    warnings.push(
      `未在 versions 中找到匹配 ${requests.map((r) => `${r.label} ${r.version}`).join(' + ')} 的版本，已按 ${runtime.minecraft} 启动。`
    );
    return {
      id: runtime.minecraft,
      via: 'fallback',
      rootId: runtime.minecraft,
      chain: readVersionChain(versionsDir, runtime.minecraft),
      loaderLabels: [],
      warnings,
    };
  }

  throw new LaunchError(
    'LAUNCH_VERSION_NOT_FOUND',
    `实例需要 ${requests.map((r) => `${r.label} ${r.version}`).join(' + ')}（Minecraft ${runtime.minecraft}），但 versions 目录中没有匹配的版本，请先安装或修复该实例。`,
    { versionsDir, requested: requests, available: ids }
  );
}

// ==================== 依赖完整性检查 ====================

const PLATFORM_OS = process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'osx' : 'linux';

function libraryApplies(lib: { rules?: { action?: string; os?: { name?: string } }[] }): boolean {
  const rules = lib.rules;
  if (!rules?.length) return true;
  let allowed = false;
  for (const rule of rules) {
    const osMatches = !rule.os?.name || rule.os.name === PLATFORM_OS;
    if (osMatches) allowed = rule.action === 'allow';
  }
  return allowed;
}

/** Maven 坐标 → libraries 下的相对路径 */
export function mavenRelativePath(name: string): string | null {
  if (!name) return null;
  const [coords, rawExt] = name.split('@');
  const ext = rawExt || 'jar';
  const parts = coords.split(':');
  const [group, artifact, version, classifier] = parts;
  if (!group || !artifact || !version) return null;
  return `${group.replace(/\./g, '/')}/${artifact}/${version}/${artifact}-${version}${
    classifier ? `-${classifier}` : ''
  }.${ext}`;
}

export interface DependencyReport {
  ready: boolean;
  missingLibraries: string[];
  missingVersions: string[];
  missingJar?: string;
  missingAssetIndex?: string;
  checkedLibraries: number;
  checkedAssets: number;
  warnings: string[];
}

/**
 * 启动前依赖体检：版本 JSON / 客户端 JAR / libraries / assets index。
 * 只做存在性检查（不校验和），失败项可直接交给实例修复流程补齐。
 */
export function checkDependencies(resourceRoot: string, versionId: string, sampleAssets = 0): DependencyReport {
  const versionsDir = path.join(resourceRoot, 'versions');
  const chain = readVersionChain(versionsDir, versionId);
  const missingVersions: string[] = [];
  const missingLibraries: string[] = [];
  const warnings = [...chain.warnings];
  let jarId: string | undefined;
  let assetIndex: string | undefined;
  let checkedLibraries = 0;
  let checkedAssets = 0;

  for (const id of chain.chain) {
    const jsonPath = path.join(versionsDir, id, `${id}.json`);
    const json: VersionJsonLite | null = readVersionJson(jsonPath);
    if (!json) {
      missingVersions.push(id);
      continue;
    }
    if (!jarId && json.downloads) jarId = json.jar || id;
    if (!assetIndex) assetIndex = json.assetIndex?.id || json.assets;

    for (const lib of json.libraries || []) {
      if (!libraryApplies(lib)) continue;
      const relative = lib.downloads?.artifact?.path || mavenRelativePath(lib.name || '');
      if (!relative || relative.includes('${')) continue;
      checkedLibraries += 1;
      if (!exists(path.join(resourceRoot, 'libraries', relative)) && !missingLibraries.includes(relative)) {
        missingLibraries.push(relative);
      }
    }
  }

  let missingJar: string | undefined;
  const jarTarget = jarId && chain.chain.includes(jarId) ? jarId : chain.chain[chain.chain.length - 1];
  if (jarTarget) {
    const jarPath = path.join(versionsDir, jarTarget, `${jarTarget}.jar`);
    if (!exists(jarPath)) missingJar = jarPath;
  }

  let missingAssetIndex: string | undefined;
  if (assetIndex) {
    const indexPath = path.join(resourceRoot, 'assets', 'indexes', `${assetIndex}.json`);
    if (!exists(indexPath)) {
      missingAssetIndex = indexPath;
    } else if (sampleAssets > 0) {
      const index = readVersionJson<{ objects?: Record<string, { hash?: string }> }>(indexPath);
      const objects = index?.objects ? Object.values(index.objects) : [];
      for (const object of objects.slice(0, sampleAssets)) {
        const hash = object?.hash;
        if (!hash) continue;
        checkedAssets += 1;
        const objectPath = path.join(resourceRoot, 'assets', 'objects', hash.slice(0, 2), hash);
        if (!exists(objectPath)) {
          missingAssetIndex = indexPath;
          break;
        }
      }
    }
  }

  return {
    ready:
      missingVersions.length === 0 &&
      missingLibraries.length === 0 &&
      !missingJar &&
      !missingAssetIndex,
    missingLibraries,
    missingVersions,
    missingJar,
    missingAssetIndex,
    checkedLibraries,
    checkedAssets,
    warnings,
  };
}

// ==================== 文件完整性校验（大小 / SHA1） ====================

export interface IntegrityReport {
  /** 没有发现损坏文件 */
  ready: boolean;
  /** 客户端 JAR 校验失败时的绝对路径 */
  corruptedJar?: string;
  /** 校验失败的依赖库（相对 libraries 的路径） */
  corruptedLibraries: string[];
  checkedLibraries: number;
  warnings: string[];
}

function fileSizeOf(target: string): number | null {
  try {
    return fs.statSync(target).size;
  } catch {
    return null;
  }
}

function sha1Of(target: string): string | null {
  try {
    return createHash('sha1').update(fs.readFileSync(target)).digest('hex');
  } catch {
    return null;
  }
}

/**
 * 启动前的深度校验：按版本 JSON 里的 size / sha1 校验客户端 JAR 与依赖库。
 * 只校验已存在的文件（缺失项由 checkDependencies 负责），只读不修改磁盘。
 *
 * 存在的意义：文件"在"不代表文件"对"。从别的启动器导入 / 下载中断时，
 * xmcl 的启动前置检查会报 `Corrupted Version jar` / `Missing N libraries`，
 * 提前校验出来就能交给修复流程重新下载。
 */
export function verifyDependencies(resourceRoot: string, versionId: string): IntegrityReport {
  const versionsDir = path.join(resourceRoot, 'versions');
  const chain = readVersionChain(versionsDir, versionId);
  const warnings = [...chain.warnings];
  const corruptedLibraries: string[] = [];
  let checkedLibraries = 0;
  let expectedJar: { id: string; sha1?: string; size?: number } | null = null;

  for (const id of chain.chain) {
    const json = readVersionJson(path.join(versionsDir, id, `${id}.json`));
    if (!json) continue;
    if (!expectedJar && json.downloads?.client) {
      expectedJar = { id: json.jar || id, sha1: json.downloads.client.sha1, size: json.downloads.client.size };
    }

    for (const lib of json.libraries || []) {
      if (!libraryApplies(lib)) continue;
      const artifact = lib.downloads?.artifact;
      const relative = artifact?.path || mavenRelativePath(lib.name || '');
      if (!relative || relative.includes('${')) continue;
      const target = path.join(resourceRoot, 'libraries', relative);
      if (!exists(target)) continue;
      checkedLibraries += 1;

      if (artifact?.sha1) {
        if (sha1Of(target) !== artifact.sha1) corruptedLibraries.push(relative);
        continue;
      }
      const size = artifact?.size;
      if (typeof size === 'number' && size > 0 && fileSizeOf(target) !== size) corruptedLibraries.push(relative);
    }
  }

  let corruptedJar: string | undefined;
  if (expectedJar && chain.chain.includes(expectedJar.id)) {
    const jarPath = path.join(versionsDir, expectedJar.id, `${expectedJar.id}.jar`);
    if (exists(jarPath)) {
      const sizeBad =
        typeof expectedJar.size === 'number' && expectedJar.size > 0 && fileSizeOf(jarPath) !== expectedJar.size;
      const sha1Bad = expectedJar.sha1 ? sha1Of(jarPath) !== expectedJar.sha1 : false;
      if (sizeBad || sha1Bad) corruptedJar = jarPath;
    }
  }

  return {
    ready: !corruptedJar && corruptedLibraries.length === 0,
    corruptedJar,
    corruptedLibraries,
    checkedLibraries,
    warnings,
  };
}

/** 完整性问题 → 可读中文 */
export function describeIntegrityReport(report: IntegrityReport): string {
  const parts: string[] = [];
  if (report.corruptedJar) parts.push(`客户端 JAR 校验失败（${path.basename(report.corruptedJar)}）`);
  if (report.corruptedLibraries.length) parts.push(`${report.corruptedLibraries.length} 个依赖库校验失败`);
  return parts.join('；');
}

/** 依赖缺失时生成可读的中文错误 */
export function describeDependencyReport(report: DependencyReport): string {
  const parts: string[] = [];
  if (report.missingVersions.length) parts.push(`版本 JSON 缺失：${report.missingVersions.join('、')}`);
  if (report.missingJar) parts.push('客户端 JAR 缺失');
  if (report.missingLibraries.length) {
    const preview = report.missingLibraries.slice(0, 3).join('、');
    parts.push(
      `缺少 ${report.missingLibraries.length} 个依赖库${report.missingLibraries.length > 3 ? `（如 ${preview} 等）` : `（${preview}）`}`
    );
  }
  if (report.missingAssetIndex) parts.push('资源索引（assets）缺失');
  return parts.join('；');
}

// ==================== 启动方案（根目录 + 版本 + 依赖） ====================

export interface LaunchPlanInput {
  instancePath: string;
  runtime: InstanceRuntimeSpec;
  /** 实例自定义资源根（引用式导入时指向源游戏目录） */
  resourcePath?: string;
  /** 全局共享资源目录 */
  sharedResourceDir?: string;
  /** 实例显式指定的启动版本 id（instance.json 的 launchVersion） */
  preferredVersionId?: string;
  /**
   * 全局版本隔离档位。缺省 / `instance` = 沿用实例自带 gameRoot（旧行为），
   * `version` / `none` 会按 `resolveGameDataDir()` 改写 `roots.gameRoot`。
   */
  isolation?: GameIsolation;
}

export interface LaunchPlan {
  roots: LaunchRoots;
  resolved: ResolvedLaunch;
  dependencies: DependencyReport;
  /** 可读问题清单（供实例健康状态与 UI 提示），空数组 = 完全就绪 */
  issues: string[];
}

/**
 * 一次性算出「到哪里启动、启动哪个版本、还缺什么」。
 * 任何一步失败都抛 LaunchError（code 可直接映射到 UI 提示与修复动作）。
 */
export function resolveLaunchPlan(input: LaunchPlanInput): LaunchPlan {
  const roots = resolveLaunchRoots({
    instancePath: input.instancePath,
    runtime: input.runtime,
    resourcePath: input.resourcePath,
    sharedResourceDir: input.sharedResourceDir,
  });

  const versionsDir = path.join(roots.resourceRoot, 'versions');
  const resolved = resolveLaunchVersionId(versionsDir, input.runtime, input.preferredVersionId);
  const dependencies = checkDependencies(roots.resourceRoot, resolved.id);

  // 版本隔离：只改写运行数据目录（--gameDir），资源根不变
  const isolation = input.isolation;
  if (isolation === 'none' || isolation === 'version') {
    roots.gameRoot = resolveGameDataDir({
      instancePath: input.instancePath,
      isolation,
      resourceRoot: roots.resourceRoot,
      versionId: resolved.id,
    });
  }

  const issues = [...resolved.warnings, ...dependencies.warnings];
  if (!dependencies.ready) issues.push(describeDependencyReport(dependencies));

  return { roots, resolved, dependencies, issues };
}
