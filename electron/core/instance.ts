import * as fs from 'fs';
import * as path from 'path';
import { Version, type ResolvedVersion } from '@xmcl/core';
import {
  getFabricLoaders,
  getForgeVersionList as xmclGetForgeVersionList,
  getLoaderArtifactListFor,
  getQuiltLoaderVersionsByMinecraft,
  getVersionList as xmclGetVersionList,
  install as xmclInstall,
  installDependencies,
  installFabric,
  installForge,
  installNeoForged,
  installQuiltVersion,
  type Options,
} from '@xmcl/installer';
import { getConfig } from '../config';
import {
  BMCLAPI_ASSETS,
  BMCLAPI_MAVEN,
  BMCLAPI_VERSION_MANIFEST,
  buildInstallOptions,
  resolveDownloadSource,
  rewriteToMirror,
  sanitizeThreads,
  versionListRequest,
  type DownloadSettings,
} from './download-options';
import { resolveJavaPath } from './launch-options';
import { resolveGamePath } from './paths';
import {
  LaunchError,
  checkDependencies,
  describeDependencyReport,
  loaderRequests,
  resolveLaunchPlan,
  resolveLaunchRoots,
  resolveLaunchVersionId,
  type LaunchPlan,
  type ResolvedLaunch,
} from './launch-target';
import {
  detectLoaderVersionsFromJson,
  readVersionChain,
  readVersionJson,
  scanGameDirectories,
  type LoaderKey,
  type ScannedVersion,
  type VersionChain,
} from './version-scan';

export {
  BMCLAPI_ASSETS,
  BMCLAPI_MAVEN,
  BMCLAPI_VERSION_MANIFEST,
  rewriteToMirror,
  scanGameDirectories,
};
export type { ScannedVersion };

/**
 * 实例管理。
 *
 * 目录约定：
 * - 游戏根目录（config.game.gameDir，例如 `.minecraft`）存放 `instances/<实例名>/`
 * - 实例目录本身就是一个「游戏目录」：`versions/`（版本文件）、`libraries/`、`assets/`、
 *   `mods/`、`saves/`、`logs/` …
 * - 引用式导入（importMode: 'reference'）的实例把 `resourcePath` 指向源游戏目录，此时
 *   版本与资源来自源目录，不复制任何文件。
 *
 * 启动相关的一切（选哪个版本、从哪里找 libraries/assets、还缺什么）统一交给
 * `launch-target.ts` 的 `resolveLaunchPlan()` 计算，本文件只负责目录与元数据。
 */

export const INSTANCE_CONFIG_FILE = 'instance.json';

const INSTANCE_SUBDIRS = ['mods', 'config', 'resourcepacks', 'shaderpacks', 'saves', 'screenshots', 'logs'];

export const mirrorFetch: typeof fetch = (input, init) => fetch(rewriteToMirror(String(input)), init);

export interface InstanceRuntime {
  minecraft: string;
  forge?: string;
  neoForged?: string;
  fabricLoader?: string;
  quiltLoader?: string;
  optifine?: string;
}

/** 导入方式：copy = 复制版本文件到实例；reference = 直接引用源游戏目录 */
export type ImportMode = 'copy' | 'reference';

export interface InstanceConfig {
  name: string;
  author?: string;
  description?: string;
  runtime: InstanceRuntime;
  /** 显式指定的启动版本 id（含加载器后缀）；留空则按 runtime 自动解析 */
  launchVersion?: string;
  /** 实例自定义资源根：指向提供 versions/libraries/assets 的目录（引用式导入时使用） */
  resourcePath?: string;
  /** 导入方式（仅导入产生的实例有值） */
  importMode?: ImportMode;
  java?: string;
  minMemory?: number;
  maxMemory?: number;
  vmOptions?: string[];
  mcOptions?: string[];
  server?: { host: string; port?: number; name?: string };
  showLog?: boolean;
  hideLauncher?: boolean;
  icon?: string;
  /** 是否收藏（画廊星标，跨启动持久化在 instance.json） */
  favorite?: boolean;
  /** 用户自定义分类标签（画廊筛选用，自由文本；空 = 未分类） */
  category?: string;
  creationDate: number;
  lastAccessDate: number;
  lastPlayedDate: number;
  playtime: number;
}

/** 启动目标的 UI 快照（来自 resolveLaunchPlan） */
export interface InstanceLaunchInfo {
  /** 实际用于启动的版本 id */
  versionId: string;
  /** 版本是如何选出来的：configured / base / loader / fallback / unknown */
  via: ResolvedLaunch['via'] | 'unknown';
  /** 提供 versions/libraries/assets 的目录 */
  resourceRoot: string;
  /** 提供 saves/mods/logs 的目录（传给 --gameDir） */
  gameRoot: string;
  rootSource: LaunchPlan['roots']['source'] | 'unknown';
  loaderLabels: string[];
  warnings: string[];
}

/** 依赖体检的 UI 快照 */
export interface InstanceDependencyInfo {
  ready: boolean;
  missingLibraries: number;
  missingVersions: string[];
  missingJar: boolean;
  missingAssetIndex: boolean;
  checkedLibraries: number;
}

export interface InstanceInfo {
  name: string;
  path: string;
  config: InstanceConfig;
  modCount: number;
  resourcePackCount: number;
  screenshotCount: number;
  saveCount: number;
  healthy: boolean;
  issues: string[];
  launch: InstanceLaunchInfo;
  dependency: InstanceDependencyInfo;
}

export interface InstallProgress {
  stage: string;
  current: number;
  total: number;
  message?: string;
}

export interface InstallCallbacks {
  onProgress?: (progress: InstallProgress) => void;
}

export interface ImportInstanceOptions {
  description?: string;
  java?: string;
  minMemory?: number;
  maxMemory?: number;
  /** 版本文件来源目录（扫描副目录导入时传扫描目录） */
  sourceGamePath?: string;
  /** 导入方式，默认 reference（不复制文件，直接引用源目录） */
  mode?: ImportMode;
}

export function getInstanceConfigPath(instancePath: string): string {
  return path.join(instancePath, INSTANCE_CONFIG_FILE);
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

function countFiles(dir: string, ext?: string): number {
  if (!isDirectory(dir)) return 0;
  try {
    return fs.readdirSync(dir).filter((file) => (ext ? file.endsWith(ext) : true)).length;
  } catch {
    return 0;
  }
}

function readInstanceConfig(instancePath: string): InstanceConfig {
  const file = getInstanceConfigPath(instancePath);
  if (!exists(file)) {
    throw new LaunchError('INSTANCE_NOT_FOUND', `Instance not found: ${path.basename(instancePath)}`, {
      instancePath,
    });
  }
  return JSON.parse(fs.readFileSync(file, 'utf-8')) as InstanceConfig;
}

/** 读取权威下载配置（未显式传入时使用 Koring.yml 中的设置） */
function downloadSettings(explicit?: DownloadSettings): DownloadSettings {
  if (explicit) return explicit;
  const { download } = getConfig();
  return {
    source: download.source as DownloadSettings['source'],
    threads: download.threads,
    customVersionManifest: download.customVersionManifest,
    customMavenHost: download.customMavenHost,
    customAssetsHost: download.customAssetsHost,
  };
}

// ==================== 实例名校验 ====================

/**
 * Windows 保留设备名：作为目录名时无法创建（即使带扩展名）。
 * 其他平台不拦，但统一提示可避免跨平台迁移时踩坑。
 */
const RESERVED_DEVICE_NAMES = new Set([
  'CON',
  'PRN',
  'AUX',
  'NUL',
  ...Array.from({ length: 9 }, (_, i) => `COM${i + 1}`),
  ...Array.from({ length: 9 }, (_, i) => `LPT${i + 1}`),
]);

/** 实例名长度上限（目录名，避免超过常见文件系统限制） */
export const MAX_INSTANCE_NAME_LENGTH = 64;

export type InstanceNameProblemCode =
  | 'empty'
  | 'too-long'
  | 'invalid-char'
  | 'reserved-name'
  | 'exists'
  | 'location-missing';

export interface InstanceNameCheck {
  /** 原始输入 */
  name: string;
  /** 去掉首尾空白的名称（落盘用这个） */
  normalized: string;
  /** 实例目录绝对路径 */
  path: string;
  available: boolean;
  code: InstanceNameProblemCode | null;
  /** 人类可读的原因（available 为 true 时为空串） */
  reason: string;
  /** 大小写不敏感的同名目录（Windows / macOS 上会真冲突） */
  conflicts: string[];
}

/** 名称归一化：仅去掉首尾空白（内部空白是否替换由 UI 决定，核心不做二次加工） */
export function normalizeInstanceName(raw: string): string {
  return String(raw ?? '').trim();
}

/**
 * 校验实例名的「格式合法性」（不查磁盘）。
 * @returns 问题代码；合法时返回 null
 */
export function validateInstanceName(name: string): { code: InstanceNameProblemCode; reason: string } | null {
  const raw = String(name ?? '');

  if (!raw.trim()) {
    return { code: 'empty', reason: '实例名不能为空' };
  }
  if (raw !== raw.trim()) {
    return { code: 'invalid-char', reason: '实例名不能以空格开头或结尾' };
  }
  if (raw.length > MAX_INSTANCE_NAME_LENGTH) {
    return { code: 'too-long', reason: `实例名不能超过 ${MAX_INSTANCE_NAME_LENGTH} 个字符` };
  }
  // 路径分隔符与 Windows 非法字符；控制字符一并拒绝
  if (/[<>:"/\\|?*\u0000-\u001f]/.test(raw)) {
    return { code: 'invalid-char', reason: '实例名不能包含 \\ / : * ? " < > | 等字符' };
  }
  if (raw === '.' || raw === '..') {
    return { code: 'invalid-char', reason: '实例名不能是 . 或 ..' };
  }
  if (/[. ]$/.test(raw)) {
    return { code: 'invalid-char', reason: '实例名不能以空格或点结尾' };
  }
  // 设备名判定只看主名（CON.txt 同样不可用）
  const base = raw.split('.')[0].toUpperCase();
  if (RESERVED_DEVICE_NAMES.has(base)) {
    return { code: 'reserved-name', reason: `${base} 是系统保留名称，请换一个` };
  }
  return null;
}

/**
 * 创建前的完整预检：格式校验 + 目录占用检查（含大小写不敏感的同名冲突）。
 * 与 `createInstance` 的判定保持一致，供 UI 在提交前实时禁用「安装」按钮。
 */
export function checkInstanceName(name: string, gamePath: string): InstanceNameCheck {
  const resolvedGamePath = resolveGamePath(gamePath);
  const normalized = normalizeInstanceName(name);
  const instancePath = path.join(resolvedGamePath, 'instances', normalized);

  // 同名冲突（大小写不敏感），用于提示「已存在同名但大小写不同」的情况
  let conflicts: string[] = [];
  const root = path.join(resolvedGamePath, 'instances');
  if (normalized && isDirectory(root)) {
    try {
      conflicts = fs
        .readdirSync(root, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .filter((entry) => entry !== normalized && entry.toLowerCase() === normalized.toLowerCase());
    } catch {
      conflicts = [];
    }
  }

  const invalid = validateInstanceName(name);
  if (invalid) {
    return {
      name,
      normalized,
      path: instancePath,
      available: false,
      code: invalid.code,
      reason: invalid.reason,
      conflicts,
    };
  }

  if (!resolvedGamePath) {
    return {
      name,
      normalized,
      path: instancePath,
      available: false,
      code: 'location-missing',
      reason: '未指定游戏目录',
      conflicts,
    };
  }

  if (exists(instancePath)) {
    return {
      name,
      normalized,
      path: instancePath,
      available: false,
      code: 'exists',
      reason: conflicts.length
        ? `已存在同名实例（大小写不同：${conflicts.join('、')}）`
        : '已存在同名实例',
      conflicts,
    };
  }

  return {
    name,
    normalized,
    path: instancePath,
    available: true,
    code: null,
    reason: '',
    conflicts,
  };
}

/** 落盘前的强校验：不合法直接抛错，防止创建出无法启动/无法迁移的目录 */
function assertValidInstanceName(name: string): string {
  const normalized = normalizeInstanceName(name);
  const invalid = validateInstanceName(normalized);
  if (invalid) {
    throw new Error(invalid.reason);
  }
  return normalized;
}

// ==================== 安装位置（多游戏目录） ====================

/**
 * 一个「安装位置」= 一个游戏根目录（`instances/` 的父目录）。
 * 默认位置取 `config.game.gameDir`，其余来自 `config.game.gameDirs`。
 */
export interface InstallLocation {
  /** 配置中的原始值（可能是相对路径） */
  path: string;
  /** 解析后的绝对路径 */
  resolvedPath: string;
  /** 展示名：默认目录为「默认」，其余取目录名 */
  label: string;
  isDefault: boolean;
  exists: boolean;
  /** 是否可写（决定能否在此新建实例） */
  writable: boolean;
  /** 该位置下已有实例数 */
  instanceCount: number;
  /** 该位置下已安装版本数（>0 说明可复用 libraries/assets） */
  versionCount: number;
}

function countSubdirectories(target: string): number {
  if (!isDirectory(target)) return 0;
  try {
    return fs.readdirSync(target, { withFileTypes: true }).filter((entry) => entry.isDirectory()).length;
  } catch {
    return 0;
  }
}

function isWritable(target: string): boolean {
  try {
    fs.accessSync(target, fs.constants.W_OK);
    return true;
  } catch {
    // 目录不存在时，看父目录是否可写（安装时会自动创建）
    try {
      fs.accessSync(path.dirname(target), fs.constants.W_OK);
      return true;
    } catch {
      return false;
    }
  }
}

function normalizeForCompare(target: string): string {
  const resolved = path.resolve(target).replace(/[\\/]+$/, '');
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

/** 列出所有可用安装位置（默认目录在首位，按路径去重） */
export function listInstallLocations(): InstallLocation[] {
  const { game } = getConfig();
  const entries: { path: string; isDefault: boolean }[] = [
    { path: game.gameDir, isDefault: true },
    ...(game.gameDirs ?? []).map((item) => ({ path: item, isDefault: false })),
  ];

  const seen = new Set<string>();
  const result: InstallLocation[] = [];

  for (const entry of entries) {
    if (!entry.path) continue;
    const resolvedPath = resolveGamePath(entry.path);
    if (!resolvedPath) continue;
    const key = normalizeForCompare(resolvedPath);
    if (seen.has(key)) continue;
    seen.add(key);

    result.push({
      path: entry.path,
      resolvedPath,
      label: entry.isDefault ? '默认' : path.basename(resolvedPath) || resolvedPath,
      isDefault: entry.isDefault,
      exists: isDirectory(resolvedPath),
      writable: isWritable(resolvedPath),
      instanceCount: countSubdirectories(path.join(resolvedPath, 'instances')),
      versionCount: countSubdirectories(path.join(resolvedPath, 'versions')),
    });
  }

  return result;
}

/** 带归属信息的实例（多安装位置聚合后的条目） */
export interface InstanceWithLocation extends InstanceInfo {
  /** 实例所属游戏根目录（绝对路径） */
  gamePath: string;
  /** 所属安装位置的展示名 */
  locationLabel: string;
  isDefaultLocation: boolean;
}

/**
 * 跨所有安装位置扫描实例。
 * 单个位置损坏不影响其他位置；结果按最近游玩时间倒序。
 */
export function listAllInstances(): {
  locations: InstallLocation[];
  instances: InstanceWithLocation[];
} {
  const locations = listInstallLocations();
  const instances: InstanceWithLocation[] = [];
  const seenKeys = new Set<string>();

  for (const location of locations) {
    let items: InstanceInfo[] = [];
    try {
      items = listInstances(location.resolvedPath);
    } catch {
      items = [];
    }

    for (const info of items) {
      // 同一物理目录被两个位置同时收录时只保留第一个（默认位置优先）
      const key = normalizeForCompare(info.path);
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);

      instances.push({
        ...info,
        gamePath: location.resolvedPath,
        locationLabel: location.label,
        isDefaultLocation: location.isDefault,
      });
    }
  }

  instances.sort((a, b) => (b.config.lastPlayedDate || 0) - (a.config.lastPlayedDate || 0));
  return { locations, instances };
}

// ==================== 实例 CRUD ====================

export function createInstance(
  name: string,
  gamePath: string,
  runtime: InstanceRuntime,
  options?: Partial<
    Pick<
      InstanceConfig,
      | 'author'
      | 'description'
      | 'java'
      | 'minMemory'
      | 'maxMemory'
      | 'vmOptions'
      | 'mcOptions'
      | 'launchVersion'
      | 'resourcePath'
      | 'importMode'
    >
  >
): InstanceInfo {
  assertValidInstanceName(name);
  const instancePath = path.join(gamePath, 'instances', name);
  if (exists(instancePath)) {
    throw new Error(`已存在同名实例：${name}`);
  }

  fs.mkdirSync(instancePath, { recursive: true });
  for (const dir of INSTANCE_SUBDIRS) {
    fs.mkdirSync(path.join(instancePath, dir), { recursive: true });
  }

  const now = Date.now();
  const config: InstanceConfig = {
    name,
    author: options?.author,
    description: options?.description,
    runtime,
    launchVersion: options?.launchVersion,
    resourcePath: options?.resourcePath,
    importMode: options?.importMode,
    java: options?.java,
    minMemory: options?.minMemory,
    maxMemory: options?.maxMemory,
    vmOptions: options?.vmOptions,
    mcOptions: options?.mcOptions,
    creationDate: now,
    lastAccessDate: now,
    lastPlayedDate: 0,
    playtime: 0,
  };
  fs.writeFileSync(getInstanceConfigPath(instancePath), JSON.stringify(config, null, 2), 'utf-8');

  return getInstanceInfo(name, gamePath);
}

export function listInstances(gamePath: string): InstanceInfo[] {
  const root = path.join(gamePath, 'instances');
  if (!isDirectory(root)) return [];

  const result: InstanceInfo[] = [];
  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return [];
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      result.push(getInstanceInfo(entry.name, gamePath));
    } catch {
      // 忽略损坏的实例目录
    }
  }
  return result;
}

/** 计算实例的启动目标与依赖状态；失败时返回可读问题而不是抛错 */
function buildLaunchStatus(
  instancePath: string,
  config: InstanceConfig
): { launch: InstanceLaunchInfo; dependency: InstanceDependencyInfo; issues: string[] } {
  const runtime = config.runtime;
  const loaderLabels = loaderRequests(runtime).map((request) => `${request.label} ${request.version}`);

  try {
    const plan = resolveLaunchPlan({
      instancePath,
      runtime,
      resourcePath: config.resourcePath,
      sharedResourceDir: getConfig().game.resourceDir || undefined,
      preferredVersionId: config.launchVersion,
    });
    return {
      launch: {
        versionId: plan.resolved.id,
        via: plan.resolved.via,
        resourceRoot: plan.roots.resourceRoot,
        gameRoot: plan.roots.gameRoot,
        rootSource: plan.roots.source,
        loaderLabels,
        warnings: plan.resolved.warnings,
      },
      dependency: {
        ready: plan.dependencies.ready,
        missingLibraries: plan.dependencies.missingLibraries.length,
        missingVersions: plan.dependencies.missingVersions,
        missingJar: Boolean(plan.dependencies.missingJar),
        missingAssetIndex: Boolean(plan.dependencies.missingAssetIndex),
        checkedLibraries: plan.dependencies.checkedLibraries,
      },
      issues: plan.issues,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      launch: {
        versionId: config.launchVersion || runtime.minecraft,
        via: 'unknown',
        resourceRoot: instancePath,
        gameRoot: instancePath,
        rootSource: 'instance',
        loaderLabels,
        warnings: [],
      },
      dependency: {
        ready: false,
        missingLibraries: 0,
        missingVersions: [],
        missingJar: false,
        missingAssetIndex: false,
        checkedLibraries: 0,
      },
      issues: [message],
    };
  }
}

export function getInstanceInfo(name: string, gamePath: string): InstanceInfo {
  const instancePath = path.join(gamePath, 'instances', name);
  const config = readInstanceConfig(instancePath);
  const status = buildLaunchStatus(instancePath, config);

  return {
    name,
    path: instancePath,
    config,
    modCount: countFiles(path.join(instancePath, 'mods'), '.jar'),
    resourcePackCount: countFiles(path.join(instancePath, 'resourcepacks'), '.zip'),
    screenshotCount: countFiles(path.join(instancePath, 'screenshots')),
    saveCount: countFiles(path.join(instancePath, 'saves')),
    healthy: status.issues.length === 0,
    issues: status.issues,
    launch: status.launch,
    dependency: status.dependency,
  };
}

/**
 * 解析可启动方案（供启动流程使用）。
 * 实例不存在或缺少可启动版本/依赖时抛 LaunchError。
 */
export function planInstanceLaunch(
  name: string,
  gamePath: string
): { instance: InstanceInfo; plan: LaunchPlan } {
  const instance = getInstanceInfo(name, gamePath);
  const plan = resolveLaunchPlan({
    instancePath: instance.path,
    runtime: instance.config.runtime,
    resourcePath: instance.config.resourcePath,
    sharedResourceDir: getConfig().game.resourceDir || undefined,
    preferredVersionId: instance.config.launchVersion,
  });

  if (!plan.dependencies.ready) {
    throw new LaunchError(
      'LAUNCH_DEPENDENCIES_MISSING',
      `实例「${name}」缺少启动所需的文件：${describeDependencyReport(plan.dependencies)}。可在实例详情或游戏目录页执行「修复」。`,
      { instancePath: instance.path, dependency: plan.dependencies }
    );
  }

  return { instance, plan };
}

export function updateInstance(
  name: string,
  gamePath: string,
  patch: Partial<InstanceConfig>
): InstanceInfo {
  const instancePath = path.join(gamePath, 'instances', name);
  const config = readInstanceConfig(instancePath);
  const next: InstanceConfig = { ...config, ...patch };
  fs.writeFileSync(getInstanceConfigPath(instancePath), JSON.stringify(next, null, 2), 'utf-8');
  return getInstanceInfo(name, gamePath);
}

export function deleteInstance(name: string, gamePath: string): { deleted: string } {
  const instancePath = path.join(gamePath, 'instances', name);
  fs.rmSync(instancePath, { recursive: true, force: true });
  return { deleted: name };
}

export function diagnoseInstance(
  name: string,
  gamePath: string
): { healthy: boolean; issues: string[]; launch: InstanceLaunchInfo; dependency: InstanceDependencyInfo } {
  const info = getInstanceInfo(name, gamePath);
  return { healthy: info.healthy, issues: info.issues, launch: info.launch, dependency: info.dependency };
}

// ==================== 安装 / 修复 ====================

type ProgressReporter = (stage: string, message: string, current?: number, total?: number) => void;

async function resolveLoaderVersion(
  key: LoaderKey,
  requested: string,
  mcVersion: string,
  source: ReturnType<typeof resolveDownloadSource>
): Promise<string> {
  if (requested && requested !== 'latest') return requested;
  const fetchImpl = source.kind === 'bmclapi' ? mirrorFetch : undefined;

  try {
    if (key === 'forge' || key === 'neoForged') {
      const list = await xmclGetForgeVersionList({ minecraft: mcVersion });
      const preferred =
        list.versions.find((entry) => entry.type === 'recommended') ||
        list.versions.find((entry) => entry.type === 'common') ||
        list.versions[0];
      return preferred?.version || requested;
    }
    if (key === 'fabricLoader') {
      const artifacts = await getLoaderArtifactListFor(mcVersion, { fetch: fetchImpl });
      return artifacts[0]?.loader?.version || requested;
    }
    if (key === 'quiltLoader') {
      const artifacts = await getQuiltLoaderVersionsByMinecraft({
        minecraftVersion: mcVersion,
        fetch: fetchImpl,
      });
      return artifacts[0]?.loader?.version || requested;
    }
  } catch {
    // 查询失败时保留用户填写的值（含 'latest'），交给安装器自己处理
  }
  return requested;
}

/**
 * 安装实例记录的模组加载器。
 * @returns 实际安装成功的加载器版本（用于写回 instance.runtime）
 */
async function installLoaders(
  runtime: InstanceRuntime,
  target: string,
  options: Options,
  source: ReturnType<typeof resolveDownloadSource>,
  javaPath: string,
  report: ProgressReporter
): Promise<InstanceRuntime> {
  const resolvedRuntime: InstanceRuntime = { ...runtime };

  if (runtime.forge) {
    report('installing-forge', `正在安装 Forge ${runtime.forge}…`);
    const version = await resolveLoaderVersion('forge', runtime.forge, runtime.minecraft, source);
    await installForge({ version, mcversion: runtime.minecraft }, target, { ...options, java: javaPath });
    resolvedRuntime.forge = version;
  }

  if (runtime.neoForged) {
    report('installing-neoforged', `正在安装 NeoForge ${runtime.neoForged}…`);
    const version = await resolveLoaderVersion('neoForged', runtime.neoForged, runtime.minecraft, source);
    await installNeoForged('neoforge', version, target, { ...options, java: javaPath });
    resolvedRuntime.neoForged = version;
  }

  if (runtime.fabricLoader) {
    report('installing-fabric', `正在安装 Fabric Loader ${runtime.fabricLoader}…`);
    const version = await resolveLoaderVersion('fabricLoader', runtime.fabricLoader, runtime.minecraft, source);
    await installFabric({
      minecraftVersion: runtime.minecraft,
      version,
      minecraft: target,
      fetch: options.fetch,
    });
    resolvedRuntime.fabricLoader = version;
  }

  if (runtime.quiltLoader) {
    report('installing-quilt', `正在安装 Quilt Loader ${runtime.quiltLoader}…`);
    const version = await resolveLoaderVersion('quiltLoader', runtime.quiltLoader, runtime.minecraft, source);
    await installQuiltVersion({
      minecraftVersion: runtime.minecraft,
      version,
      minecraft: target,
      fetch: options.fetch,
    });
    resolvedRuntime.quiltLoader = version;
  }

  return resolvedRuntime;
}

/** 安装 Minecraft 本体（json + jar + assets + libraries） */
async function installMinecraftVersion(
  mcVersion: string,
  target: string,
  options: Options,
  source: ReturnType<typeof resolveDownloadSource>,
  settings: DownloadSettings,
  report: ProgressReporter
): Promise<void> {
  const listRequest = versionListRequest(settings);
  report('resolving', `正在获取 Minecraft ${mcVersion} 的版本信息…`);
  const list = await xmclGetVersionList({ remote: listRequest.remote, fetch: listRequest.fetch });
  const meta = list.versions.find((entry) => entry.id === mcVersion);
  if (!meta) {
    throw new LaunchError('LAUNCH_VERSION_NOT_FOUND', `未找到 Minecraft 版本 ${mcVersion}，请检查下载源设置。`, {
      requested: mcVersion,
    });
  }

  const mapUrl = (url: string) => (source.rewriteRequests ? rewriteToMirror(url) : url);
  report('installing-minecraft', `正在安装 Minecraft ${mcVersion}…`);
  await xmclInstall({ id: meta.id, url: meta.url }, target, {
    ...options,
    json: (version) => mapUrl(version.url),
    client: (version) => (version.downloads.client ? mapUrl(version.downloads.client.url) : []),
  });
}

/**
 * 安装（补齐）实例：Minecraft 本体 + 模组加载器 + libraries/assets。
 */
export async function installInstanceGame(
  name: string,
  gamePath: string,
  callbacks?: InstallCallbacks,
  download?: DownloadSettings
): Promise<InstanceInfo> {
  const instance = getInstanceInfo(name, gamePath);
  const target = instance.path;
  const runtime = instance.config.runtime;
  const settings = downloadSettings(download);
  const source = resolveDownloadSource(settings);
  const options = buildInstallOptions(settings);
  const report: ProgressReporter = (stage, message, current = 0, total = 0) =>
    callbacks?.onProgress?.({ stage, current, total, message });

  const javaPath = await resolveJavaPath(getConfig().java.javaPath);

  await installMinecraftVersion(runtime.minecraft, target, options, source, settings, report);

  const resolvedRuntime = await installLoaders(runtime, target, options, source, javaPath, report);
  if (JSON.stringify(resolvedRuntime) !== JSON.stringify(runtime)) {
    updateInstance(name, gamePath, { runtime: resolvedRuntime });
  }

  report('installing-dependencies', '正在校验依赖库与资源文件…');
  const versionsDir = path.join(target, 'versions');
  const resolved = resolveLaunchVersionId(versionsDir, resolvedRuntime);
  const parsed: ResolvedVersion = await Version.parse(target, resolved.id);
  await installDependencies(parsed, options);

  report('done', '安装完成');
  updateInstance(name, gamePath, {
    lastAccessDate: Date.now(),
    launchVersion: resolved.id,
    importMode: instance.config.importMode,
  });
  return getInstanceInfo(name, gamePath);
}

/**
 * 修复实例：按需补齐 Minecraft 本体、加载器与依赖库。
 * 用于「识别到但无法启动」的实例（典型场景：从别的启动器导入后缺少 libraries/assets）。
 */
export async function repairInstance(
  name: string,
  gamePath: string,
  callbacks?: InstallCallbacks,
  download?: DownloadSettings
): Promise<InstanceInfo> {
  const instance = getInstanceInfo(name, gamePath);
  const runtime = instance.config.runtime;
  const settings = downloadSettings(download);
  const source = resolveDownloadSource(settings);
  const options = buildInstallOptions(settings);
  const report: ProgressReporter = (stage, message, current = 0, total = 0) =>
    callbacks?.onProgress?.({ stage, current, total, message });

  const roots = resolveLaunchRoots({
    instancePath: instance.path,
    runtime,
    resourcePath: instance.config.resourcePath,
    sharedResourceDir: getConfig().game.resourceDir || undefined,
  });
  const target = roots.resourceRoot;
  const javaPath = await resolveJavaPath(getConfig().java.javaPath);

  const inspect = () => {
    try {
      return resolveLaunchPlan({
        instancePath: instance.path,
        runtime,
        resourcePath: instance.config.resourcePath,
        sharedResourceDir: getConfig().game.resourceDir || undefined,
        preferredVersionId: instance.config.launchVersion,
      });
    } catch {
      return null;
    }
  };

  let plan = inspect();
  const versionsDir = path.join(target, 'versions');
  const baseJson = path.join(versionsDir, runtime.minecraft, `${runtime.minecraft}.json`);
  const baseJar = path.join(versionsDir, runtime.minecraft, `${runtime.minecraft}.jar`);

  // 1) 补齐原版本体（版本 JSON / JAR / assets / libraries）
  if (!exists(baseJson) || !exists(baseJar) || plan?.dependencies.missingJar) {
    report('installing-minecraft', `正在补齐 Minecraft ${runtime.minecraft} 的版本文件…`);
    await installMinecraftVersion(runtime.minecraft, target, options, source, settings, report);
  }

  // 2) 补齐加载器（versions 里没有匹配的加载器版本时）
  plan = inspect();
  const hasLoaderVersion = Boolean(
    plan &&
      (plan.resolved.via === 'configured' ||
        plan.resolved.via === 'loader' ||
        loaderRequests(runtime).length === 0)
  );
  if (!hasLoaderVersion && loaderRequests(runtime).length > 0) {
    report('installing-loader', '正在补齐模组加载器…');
    const resolvedRuntime = await installLoaders(runtime, target, options, source, javaPath, report);
    if (JSON.stringify(resolvedRuntime) !== JSON.stringify(runtime)) {
      updateInstance(name, gamePath, { runtime: resolvedRuntime });
    }
  }

  // 3) 补齐依赖库与资源
  plan = inspect();
  if (!plan) {
    const fallback = resolveLaunchVersionId(versionsDir, runtime);
    plan = resolveLaunchPlan({
      instancePath: instance.path,
      runtime,
      resourcePath: instance.config.resourcePath,
      sharedResourceDir: getConfig().game.resourceDir || undefined,
      preferredVersionId: fallback.id,
    });
  }

  report('installing-dependencies', '正在校验依赖库与资源文件…');
  const parsed: ResolvedVersion = await Version.parse(plan.roots.resourceRoot, plan.resolved.id);
  await installDependencies(parsed, options);

  updateInstance(name, gamePath, {
    lastAccessDate: Date.now(),
    launchVersion: plan.resolved.id,
  });
  report('done', '修复完成');
  return getInstanceInfo(name, gamePath);
}

// ==================== 版本列表 ====================

export async function getMinecraftVersionList(type?: string, download?: DownloadSettings) {
  const settings = downloadSettings(download);
  const listRequest = versionListRequest(settings);
  const list = await xmclGetVersionList({ remote: listRequest.remote, fetch: listRequest.fetch });
  const versions = list.versions.map((entry) => ({
    id: entry.id,
    type: entry.type,
    url: entry.url,
    releaseTime: entry.releaseTime,
  }));
  return {
    versions: type ? versions.filter((entry) => entry.type === type) : versions,
    latest: list.latest,
  };
}

export async function getForgeVersionList(mcVersion?: string): Promise<string[]> {
  if (!mcVersion) return [];
  const list = await xmclGetForgeVersionList({ minecraft: mcVersion });
  return list.versions.map((entry) => entry.version);
}

export async function getFabricVersionList(mcVersion?: string): Promise<string[]> {
  if (mcVersion) {
    const artifacts = await getLoaderArtifactListFor(mcVersion, { fetch: mirrorFetch });
    return artifacts.map((entry) => entry.loader.version);
  }
  const loaders = await getFabricLoaders({ fetch: mirrorFetch });
  return loaders.map((entry) => entry.version);
}

export async function getQuiltVersionList(mcVersion?: string): Promise<string[]> {
  if (mcVersion) {
    const artifacts = await getQuiltLoaderVersionsByMinecraft({
      minecraftVersion: mcVersion,
      fetch: mirrorFetch,
    });
    return artifacts.map((entry) => entry.loader.version);
  }
  return [];
}

// ==================== NeoForge 版本列表 ====================

/**
 * NeoForge 没有列表 API（@xmcl/installer 只提供安装），只能读 maven-metadata.xml。
 * 优先 BMCLAPI 镜像，失败回退官方 maven。
 */
const NEOFORGE_MAVEN_BASES = [
  'https://bmclapi2.bangbang93.com/maven',
  'https://maven.neoforged.net/releases',
];

const MAVEN_CACHE_TTL = 10 * 60 * 1000;
const mavenVersionCache = new Map<string, { at: number; versions: string[] }>();

async function fetchMavenVersions(artifactPath: string): Promise<string[]> {
  const cached = mavenVersionCache.get(artifactPath);
  if (cached && Date.now() - cached.at < MAVEN_CACHE_TTL) return cached.versions;

  for (const base of NEOFORGE_MAVEN_BASES) {
    try {
      const response = await fetch(`${base}/${artifactPath}/maven-metadata.xml`);
      if (!response.ok) continue;
      const xml = await response.text();
      const versions = Array.from(xml.matchAll(/<version>([^<]+)<\/version>/g))
        .map((match) => match[1].trim())
        .filter(Boolean);
      if (versions.length) {
        mavenVersionCache.set(artifactPath, { at: Date.now(), versions });
        return versions;
      }
    } catch {
      // 换下一个源
    }
  }
  return [];
}

/** 版本号倒序比较：纯数字段按数值比较，含非数字段时退回字符串比较 */
function compareVersionDesc(a: string, b: string): number {
  const pa = a.split(/[.+-]/);
  const pb = b.split(/[.+-]/);
  const length = Math.max(pa.length, pb.length);

  for (let i = 0; i < length; i += 1) {
    const na = Number(pa[i]);
    const nb = Number(pb[i]);
    if (!Number.isFinite(na) || !Number.isFinite(nb)) {
      return b.localeCompare(a);
    }
    if (nb !== na) return nb - na;
  }
  return 0;
}

/**
 * 按 Minecraft 版本推导 NeoForge 的 maven 坐标与版本前缀：
 * - 1.20.1 及更早 → `net.neoforged:forge`，版本形如 47.x.x
 * - 1.20.2+ → `net.neoforged:neoforge`，版本形如 `<minor>.<patch>.x`（1.20.4 → 20.4.x）
 */
function neoForgeArtifactFor(mcVersion: string): { artifact: string; prefix: string } | null {
  const match = /^1\.(\d+)(?:\.(\d+))?$/.exec(mcVersion.trim());
  if (!match) return null;

  const minor = Number(match[1]);
  const patch = Number(match[2] ?? 0);

  if (minor < 20 || (minor === 20 && patch <= 1)) {
    return { artifact: 'net/neoforged/forge', prefix: '47.' };
  }
  return { artifact: 'net/neoforged/neoforge', prefix: `${minor}.${patch}.` };
}

/**
 * NeoForge 版本列表。
 * - 传 mcVersion：返回该 Minecraft 版本对应的 NeoForge 版本（新 → 旧）
 * - 不传：返回 `neoforge` 坐标下的全部版本
 */
export async function getNeoForgeVersionList(mcVersion?: string): Promise<string[]> {
  if (!mcVersion) {
    const all = await fetchMavenVersions('net/neoforged/neoforge');
    return [...all].sort(compareVersionDesc);
  }

  const target = neoForgeArtifactFor(mcVersion);
  if (!target) return [];

  const all = await fetchMavenVersions(target.artifact);
  return all.filter((version) => version.startsWith(target.prefix)).sort(compareVersionDesc);
}

// ==================== 加载器目录（安装表单元数据） ====================

/** 安装表单可选的加载器类型 */
export type LoaderType = 'none' | 'fabric' | 'quilt' | 'forge' | 'neoforged';

export interface LoaderOption {
  type: LoaderType;
  label: string;
  /** 是否还需要用户选择具体版本 */
  requiresVersion: boolean;
  /** 当前实现是否支持自动安装 */
  supported: boolean;
  /** 可选版本（新 → 旧）；拉取失败时为空数组 */
  versions: string[];
  /** 默认选中版本（通常是最新）；无可用版本时为 null */
  latest: string | null;
  /** 降级说明（拉取失败 / 无可用版本 / 特殊限制） */
  note?: string;
}

/**
 * 一次返回所有加载器的可用状态 + 版本列表，供安装表单直接渲染。
 * 单个加载器拉取失败不影响其他加载器（该加载器 versions 为空并带 note）。
 */
export async function getLoaderCatalog(mcVersion?: string): Promise<LoaderOption[]> {
  const settle = async (loader: () => Promise<string[]>): Promise<{ versions: string[]; failed: boolean }> => {
    try {
      return { versions: await loader(), failed: false };
    } catch {
      return { versions: [], failed: true };
    }
  };

  const [fabric, quilt, forge, neoforged] = await Promise.all([
    settle(() => getFabricVersionList(mcVersion)),
    settle(() => getQuiltVersionList(mcVersion)),
    settle(() => getForgeVersionList(mcVersion)),
    settle(() => getNeoForgeVersionList(mcVersion)),
  ]);

  const build = (
    type: LoaderType,
    label: string,
    result: { versions: string[]; failed: boolean }
  ): LoaderOption => {
    const option: LoaderOption = {
      type,
      label,
      requiresVersion: true,
      supported: true,
      versions: result.versions,
      latest: result.versions[0] ?? null,
    };
    if (result.failed) {
      option.note = `${label} 版本列表获取失败，可手动填写版本号`;
    } else if (!result.versions.length) {
      option.note = mcVersion
        ? `Minecraft ${mcVersion} 没有可用的 ${label} 版本`
        : `未获取到 ${label} 版本`;
    }
    return option;
  };

  return [
    { type: 'none', label: '原版', requiresVersion: false, supported: true, versions: [], latest: null },
    build('fabric', 'Fabric', fabric),
    build('quilt', 'Quilt', quilt),
    build('forge', 'Forge', forge),
    build('neoforged', 'NeoForge', neoforged),
  ];
}

// ==================== 导入既有版本 ====================

function copyVersionDir(sourceVersionsDir: string, targetVersionsDir: string, id: string): boolean {
  const source = path.join(sourceVersionsDir, id);
  const target = path.join(targetVersionsDir, id);
  if (!isDirectory(source)) return false;
  fs.mkdirSync(target, { recursive: true });

  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(target, entry.name);
    if (entry.isDirectory()) {
      fs.cpSync(from, to, { recursive: true });
    } else {
      fs.copyFileSync(from, to);
    }
  }
  return true;
}

/** 让实例目录共享源目录的 libraries / assets（优先符号链接，失败则该目录留空由资源根兜底） */
function linkDirectory(source: string, target: string): boolean {
  if (!isDirectory(source) || isDirectory(target)) return isDirectory(target);
  try {
    fs.symlinkSync(source, target, process.platform === 'win32' ? 'junction' : 'dir');
    return true;
  } catch {
    return false;
  }
}

/**
 * 把已安装的版本导入为实例。
 *
 * - `reference`（默认）：不复制任何文件，实例通过 `resourcePath` 直接使用源游戏目录
 *   的版本与资源（存档、模组也在源目录）。
 * - `copy`：把继承链上的版本目录复制进实例，并尝试用符号链接共享源目录的
 *   libraries/assets；链接失败时回退为引用式资源路径。
 */
export async function importExistingInstance(
  name: string,
  gamePath: string,
  versionId: string,
  options?: ImportInstanceOptions
): Promise<InstanceInfo> {
  const sourceGamePath = options?.sourceGamePath || gamePath;
  const sourceVersionsDir = path.join(sourceGamePath, 'versions');
  const sourceVersionDir = path.join(sourceVersionsDir, versionId);
  const sourceJson = path.join(sourceVersionDir, `${versionId}.json`);

  if (!exists(sourceJson)) {
    throw new LaunchError('LAUNCH_VERSION_NOT_FOUND', `源目录中找不到版本 ${versionId} 的版本文件：${sourceJson}`, {
      versionId,
      sourceGamePath,
    });
  }

  const chain: VersionChain = readVersionChain(sourceVersionsDir, versionId);
  const runtime: InstanceRuntime = { minecraft: chain.rootId };
  for (const key of Object.keys(chain.loaders) as LoaderKey[]) {
    const version = chain.loaders[key];
    if (version) runtime[key] = version;
  }

  const mode: ImportMode = options?.mode ?? 'reference';
  const instancePath = path.join(gamePath, 'instances', name);
  if (exists(instancePath)) {
    throw new Error(`Instance already exists: ${name}`);
  }

  let resourcePath: string | undefined = sourceGamePath;
  if (mode === 'copy') {
    const targetVersionsDir = path.join(instancePath, 'versions');
    fs.mkdirSync(targetVersionsDir, { recursive: true });
    for (const id of chain.chain) {
      copyVersionDir(sourceVersionsDir, targetVersionsDir, id);
    }

    const linkedLibraries = linkDirectory(
      path.join(sourceGamePath, 'libraries'),
      path.join(instancePath, 'libraries')
    );
    const linkedAssets = linkDirectory(path.join(sourceGamePath, 'assets'), path.join(instancePath, 'assets'));
    resourcePath = linkedLibraries && linkedAssets ? undefined : sourceGamePath;
  }

  createInstance(name, gamePath, runtime, {
    description: options?.description ?? `从 ${sourceGamePath} 导入的 ${versionId}`,
    java: options?.java,
    minMemory: options?.minMemory,
    maxMemory: options?.maxMemory,
    launchVersion: versionId,
    resourcePath,
    importMode: mode,
  });

  return getInstanceInfo(name, gamePath);
}

// 供 UI 展示加载器徽章（避免渲染端重复实现识别逻辑）
export function inspectVersionLoaders(gamePath: string, versionId: string): LoaderKey[] {
  const jsonPath = path.join(gamePath, 'versions', versionId, `${versionId}.json`);
  const json = readVersionJson(jsonPath);
  return json ? (Object.keys(detectLoaderVersionsFromJson(json)) as LoaderKey[]) : [];
}

// ==================== 实例图标 ====================

/**
 * 实例图标候选文件（相对实例目录，按顺序取第一个存在的）。
 * 约定：把 `logo.png` 放进实例目录即可作为图标展示（PCL2 习惯写法），
 * 没有图标时渲染端显示默认图标。
 */
export const INSTANCE_ICON_CANDIDATES = [
  'logo.png',
  'logo.jpg',
  'logo.jpeg',
  'logo.webp',
  'icon.png',
  'icon.jpg',
  'icon.jpeg',
  'icon.webp',
  path.join('PCL', 'logo.png'),
];

/**
 * 图标文件大小上限：超出则不加载并给出提示。
 * 图标经 IPC 以 data URL 传输（base64 约为原始体积的 1.33 倍），
 * 画廊同时展示多个实例，因此这里限制得比较保守。
 */
export const MAX_INSTANCE_ICON_BYTES = 2 * 1024 * 1024;

const ICON_EXT_BY_MIME: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/bmp': '.bmp',
};

export interface InstanceIconInfo {
  /** 可直接用于 <img src> 的地址：文件读成 data URL，instance.json 里的远程地址原样返回 */
  url: string | null;
  /** 图标来源：候选文件名，或 instance.json 中配置的路径 / 地址 */
  source: string | null;
  /** 图标文件修改时间（毫秒）；没有图标时为 0。渲染端用它作为缓存 key */
  mtimeMs: number;
  /** 原始字节数 */
  bytes: number;
  /** 有图标但不可用时的原因（过大 / 不是图片 / 读取失败） */
  problem?: string;
}

/** 按文件头判断图片类型（比扩展名可靠，避免把任意文件塞进 <img>） */
function sniffImageMime(buffer: Buffer): string | null {
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return 'image/png';
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  if (buffer.length >= 6 && buffer.toString('ascii', 0, 3) === 'GIF') {
    return 'image/gif';
  }
  if (buffer.length >= 2 && buffer.toString('ascii', 0, 2) === 'BM') {
    return 'image/bmp';
  }
  return null;
}

function readIconFile(file: string, source: string): InstanceIconInfo {
  try {
    const stat = fs.statSync(file);
    if (!stat.isFile()) return { url: null, source: null, mtimeMs: 0, bytes: 0 };
    if (stat.size > MAX_INSTANCE_ICON_BYTES) {
      return {
        url: null,
        source,
        mtimeMs: stat.mtimeMs,
        bytes: stat.size,
        problem: `图标文件过大（${(stat.size / 1024 / 1024).toFixed(1)} MB，上限 ${
          MAX_INSTANCE_ICON_BYTES / 1024 / 1024
        } MB），请压缩后再试`,
      };
    }
    const buffer = fs.readFileSync(file);
    const mime = sniffImageMime(buffer);
    if (!mime) {
      return { url: null, source, mtimeMs: stat.mtimeMs, bytes: buffer.length, problem: '图标不是受支持的图片格式' };
    }
    return {
      url: `data:${mime};base64,${buffer.toString('base64')}`,
      source,
      mtimeMs: stat.mtimeMs,
      bytes: buffer.length,
    };
  } catch (error) {
    return {
      url: null,
      source,
      mtimeMs: 0,
      bytes: 0,
      problem: error instanceof Error ? error.message : String(error),
    };
  }
}

const EMPTY_ICON: InstanceIconInfo = { url: null, source: null, mtimeMs: 0, bytes: 0 };

/**
 * 读取实例图标：先找实例目录下的候选文件（logo.png 等），
 * 再回退到 `instance.json` 里手写的 `icon`（data URL / http(s) 地址 / 文件路径）。
 */
export function readInstanceIcon(name: string, gamePath: string): InstanceIconInfo {
  const instancePath = path.join(gamePath, 'instances', name);
  for (const relative of INSTANCE_ICON_CANDIDATES) {
    const file = path.join(instancePath, relative);
    if (exists(file)) return readIconFile(file, relative);
  }

  let configured: string | undefined;
  try {
    configured = readInstanceConfig(instancePath).icon;
  } catch {
    configured = undefined;
  }
  if (!configured) return EMPTY_ICON;
  if (configured.startsWith('data:') || /^https?:\/\//i.test(configured)) {
    return { url: configured, source: INSTANCE_CONFIG_FILE, mtimeMs: 0, bytes: configured.length };
  }
  const file = path.isAbsolute(configured) ? configured : path.join(instancePath, configured);
  return exists(file) ? readIconFile(file, configured) : EMPTY_ICON;
}

/** 清除实例目录下所有候选图标文件，并移除 `instance.json` 里的 icon 字段 */
export function clearInstanceIcon(name: string, gamePath: string): InstanceIconInfo {
  const instancePath = path.join(gamePath, 'instances', name);
  for (const relative of INSTANCE_ICON_CANDIDATES) {
    const file = path.join(instancePath, relative);
    if (!exists(file)) continue;
    try {
      fs.rmSync(file, { force: true });
    } catch {
      // 删除失败（占用等）忽略：下次读取仍会尝试
    }
  }
  try {
    const config = readInstanceConfig(instancePath);
    if (config.icon) updateInstance(name, gamePath, { icon: undefined });
  } catch {
    // 没有 instance.json 时忽略
  }
  return EMPTY_ICON;
}

/**
 * 把外部图片设为实例图标：校验体积与真实格式后写为 `<实例目录>/logo.<ext>`，
 * 并清掉其它候选文件与 instance.json 里的旧 icon，保证读取结果唯一。
 */
export function setInstanceIcon(name: string, gamePath: string, sourcePath: string): InstanceIconInfo {
  const instancePath = path.join(gamePath, 'instances', name);
  if (!exists(getInstanceConfigPath(instancePath))) {
    throw new LaunchError('INSTANCE_NOT_FOUND', `Instance not found: ${name}`, { instancePath });
  }
  if (!exists(sourcePath)) {
    throw new Error(`图标文件不存在：${sourcePath}`);
  }
  const stat = fs.statSync(sourcePath);
  if (!stat.isFile()) {
    throw new Error(`图标路径不是文件：${sourcePath}`);
  }
  if (stat.size > MAX_INSTANCE_ICON_BYTES) {
    throw new Error(
      `图标文件过大（上限 ${MAX_INSTANCE_ICON_BYTES / 1024 / 1024} MB），请压缩后再试`
    );
  }
  const buffer = fs.readFileSync(sourcePath);
  const mime = sniffImageMime(buffer);
  const ext = mime ? ICON_EXT_BY_MIME[mime] : undefined;
  if (!ext) {
    throw new Error('不支持的文件类型，请选择 PNG / JPG / WebP 图片');
  }

  clearInstanceIcon(name, gamePath);
  fs.writeFileSync(path.join(instancePath, `logo${ext}`), buffer);
  return readInstanceIcon(name, gamePath);
}

export { checkDependencies, sanitizeThreads };
