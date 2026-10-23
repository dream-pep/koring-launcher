import { ipcInvoke, onIpcEvent } from './ipc';

export interface InstanceRuntime {
  minecraft: string;
  forge?: string;
  neoForged?: string;
  fabricLoader?: string;
  quiltLoader?: string;
  optifine?: string;
}

export interface InstanceConfig {
  name: string;
  author?: string;
  description?: string;
  runtime: InstanceRuntime;
  java?: string;
  minMemory?: number;
  maxMemory?: number;
  vmOptions?: string[];
  mcOptions?: string[];
  server?: { host: string; port?: number; name?: string };
  showLog?: boolean;
  hideLauncher?: boolean;
  icon?: string;
  /** 是否收藏（画廊星标） */
  favorite?: boolean;
  /** 自定义分类标签（自由文本，空 = 未分类） */
  category?: string;
  /** 实际用于启动的版本目录名（加载器版本或原版版本）；留空时按 runtime 推导 */
  launchVersion?: string;
  /** 资源根：引用外部游戏目录时指向该目录（导入实例默认使用） */
  resourcePath?: string;
  /** 导入方式：reference 引用原目录 / copy 复制版本文件 */
  importMode?: ImportMode;
  creationDate: number;
  lastAccessDate: number;
  lastPlayedDate: number;
  playtime: number;
}

export type ImportMode = 'copy' | 'reference';

/** 启动环境解析结果（实际会用哪个版本、资源从哪读） */
export interface InstanceLaunchInfo {
  versionId: string;
  via: 'configured' | 'base' | 'loader' | 'fallback' | 'unknown';
  resourceRoot: string;
  gameRoot: string;
  rootSource: 'instance-custom' | 'instance' | 'shared';
  loaderLabels: string[];
  warnings: string[];
}

/** 启动依赖体检结果（版本 JSON / JAR / libraries / assets） */
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

export async function createInstance(
  name: string,
  gamePath: string,
  runtime: InstanceRuntime,
  options?: {
    author?: string;
    description?: string;
    java?: string;
    minMemory?: number;
    maxMemory?: number;
    vmOptions?: string[];
    mcOptions?: string[];
    launchVersion?: string;
    resourcePath?: string;
    importMode?: ImportMode;
  }
): Promise<InstanceInfo> {
  return ipcInvoke<InstanceInfo>('instance:create', {
    name,
    gamePath,
    runtime,
    ...options,
  });
}

export async function listInstances(gamePath: string): Promise<InstanceInfo[]> {
  return ipcInvoke<InstanceInfo[]>('instance:list', { gamePath });
}

export async function getInstanceInfo(name: string, gamePath: string): Promise<InstanceInfo> {
  return ipcInvoke<InstanceInfo>('instance:info', { name, gamePath });
}

export async function deleteInstance(name: string, gamePath: string): Promise<{ deleted: string }> {
  return ipcInvoke<{ deleted: string }>('instance:delete', { name, gamePath });
}

export async function updateInstance(
  name: string,
  gamePath: string,
  patch: Partial<Omit<InstanceConfig, 'name' | 'creationDate'>>
): Promise<InstanceInfo> {
  return ipcInvoke<InstanceInfo>('instance:update', { name, gamePath, patch });
}

/** 实例图标信息（图标文件为 data URL，远程地址原样返回） */
export interface InstanceIconInfo {
  url: string | null;
  source: string | null;
  /** 文件修改时间（毫秒），可用作缓存 key */
  mtimeMs: number;
  bytes: number;
  /** 有图标但不可用时的原因（过大 / 不是图片 / 读取失败） */
  problem?: string;
}

/** 读取实例图标：实例目录下的 logo.png 等候选文件，其次 instance.json 的 icon 字段 */
export async function getInstanceIcon(name: string, gamePath: string): Promise<InstanceIconInfo> {
  return ipcInvoke<InstanceIconInfo>('instance:icon', { name, gamePath });
}

/** 从本地图片设置实例图标（写入实例目录 logo.<ext>，上限 2 MB） */
export async function setInstanceIcon(
  name: string,
  gamePath: string,
  sourcePath: string
): Promise<InstanceIconInfo> {
  return ipcInvoke<InstanceIconInfo>('instance:set-icon', { name, gamePath, sourcePath });
}

/** 清除实例图标（删除候选图标文件并清空 instance.json 的 icon） */
export async function resetInstanceIcon(name: string, gamePath: string): Promise<InstanceIconInfo> {
  return ipcInvoke<InstanceIconInfo>('instance:reset-icon', { name, gamePath });
}

export async function installInstance(
  name: string,
  gamePath: string
): Promise<{ requestId: string }> {
  return ipcInvoke<{ requestId: string }>('instance:install', { name, gamePath });
}

/**
 * 修复实例：按缺失内容补齐原版文件 / 加载器 / 依赖库。
 * 与安装一样返回 requestId，进度与结果走 instance:progress / instance:install-complete。
 */
export async function repairInstance(
  name: string,
  gamePath: string
): Promise<{ requestId: string }> {
  return ipcInvoke<{ requestId: string }>('instance:repair', { name, gamePath });
}

export async function diagnoseInstance(
  name: string,
  gamePath: string
): Promise<{
  healthy: boolean;
  issues: string[];
  launch: InstanceLaunchInfo;
  dependency: InstanceDependencyInfo;
}> {
  return ipcInvoke('instance:diagnose', { name, gamePath });
}

/** 启动环境体检：不抛错，缺版本时返回 problem 供 UI 展示并引导修复 */
export async function getInstanceLaunchInfo(
  name: string,
  gamePath: string
): Promise<{
  launch: InstanceLaunchInfo | null;
  dependency: InstanceDependencyInfo | null;
  plan: unknown;
  problem?: { code: string; message: string };
}> {
  return ipcInvoke('instance:launch-info', { name, gamePath });
}

/** 读取某个版本 JSON 里实际声明的加载器（用于识别当前实例装了哪些加载器） */
export async function getVersionLoaders(gamePath: string, versionId: string): Promise<string[]> {
  return ipcInvoke<string[]>('instance:version-loaders', { gamePath, versionId });
}

// 版本信息（含发布时间和类型）
export interface VersionEntry {
  id: string;
  type: string;
  url: string;
  releaseTime: string;
}

export interface VersionListResult {
  versions: VersionEntry[];
  latest: { release: string; snapshot: string };
}

export async function getMinecraftVersionList(type?: string): Promise<VersionListResult> {
  return ipcInvoke<VersionListResult>('instance:version-list', { type });
}

// 扫描到的已安装版本信息
export interface ScannedVersion {
  id: string;
  type: string;
  releaseTime?: string;
  hasJar: boolean;
  hasJson: boolean;
  /** 检测到的 mod 加载器 */
  loaders: string[];
  /** 是否健康（JSON + JAR 都存在） */
  healthy: boolean;
}

// ==================== 游戏文件夹识别（PCL2 式） ====================
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

/** 扫描某个游戏目录（只读） */
export async function scanGameDir(
  gamePath: string
): Promise<{ versions: ScannedVersion[]; folder: GameFolderInfo | null }> {
  return ipcInvoke<{ versions: ScannedVersion[]; folder: GameFolderInfo | null }>('instance:scan-dir', {
    gamePath,
  });
}

/** 识别任意用户选择的文件夹：自动上溯到游戏根并汇总版本/启动器信息 */
export async function inspectGameFolder(
  folderPath: string
): Promise<{ normalized: { rootPath: string; kind: GameFolderKind; warnings: string[] }; info: GameFolderInfo }> {
  return ipcInvoke('instance:inspect-dir', { folderPath });
}

/** 自动发现本机常见位置的游戏目录（官方 / PCL2 / HMCL / 当前配置） */
export async function discoverGameFolders(extraPaths?: string[]): Promise<DiscoveryResult> {
  return ipcInvoke<DiscoveryResult>('instance:discover-dirs', { extraPaths });
}

// 从已安装版本导入实例
export async function importExistingInstance(
  name: string,
  gamePath: string,
  versionId: string,
  options?: {
    description?: string;
    java?: string;
    minMemory?: number;
    maxMemory?: number;
    /** 版本文件来源目录（默认 = gamePath） */
    sourceGamePath?: string;
    /** 导入方式：reference 引用原目录（默认，秒级） / copy 复制版本文件到实例目录 */
    mode?: ImportMode;
  }
): Promise<InstanceInfo> {
  return ipcInvoke<InstanceInfo>('instance:import', {
    name,
    gamePath,
    versionId,
    ...options,
  });
}

// 通过系统对话框选择文件夹
export async function selectFolder(): Promise<{ folderPath: string } | null> {
  return ipcInvoke<{ folderPath: string } | null>('dialog:openFolder');
}

/** 在系统资源管理器中打开路径（error 为空字符串表示成功） */
export async function openPath(target: string): Promise<{ error: string }> {
  return ipcInvoke<{ error: string }>('system:open-path', { path: target });
}

export async function getForgeVersionList(mcVersion?: string): Promise<string[]> {
  return ipcInvoke<string[]>('instance:forge-version-list', { mcVersion });
}

export async function getFabricVersionList(mcVersion?: string): Promise<string[]> {
  return ipcInvoke<string[]>('instance:fabric-version-list', { mcVersion });
}

export async function getQuiltVersionList(mcVersion?: string): Promise<string[]> {
  return ipcInvoke<string[]>('instance:quilt-version-list', { mcVersion });
}

// Event listeners
export type InstallChannel = 'install' | 'repair';

export function onInstallProgress(
  callback: (data: { requestId: string; channel?: InstallChannel } & InstallProgress) => void
) {
  return onIpcEvent('instance:progress', callback);
}

export function onInstallComplete(
  callback: (data: {
    requestId: string;
    channel?: InstallChannel;
    data: InstanceInfo;
  }) => void
) {
  return onIpcEvent('instance:install-complete', callback);
}

export function onInstallError(
  callback: (data: { requestId: string; channel?: InstallChannel; error: string }) => void
) {
  return onIpcEvent('instance:install-error', callback);
}
