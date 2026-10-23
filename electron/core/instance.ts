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
  const instancePath = path.join(gamePath, 'instances', name);
  if (exists(instancePath)) {
    throw new Error(`Instance already exists: ${name}`);
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
