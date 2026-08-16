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
  creationDate: number;
  lastAccessDate: number;
  lastPlayedDate: number;
  playtime: number;
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

export async function installInstance(
  name: string,
  gamePath: string
): Promise<{ requestId: string }> {
  return ipcInvoke<{ requestId: string }>('instance:install', { name, gamePath });
}

export async function launchInstance(
  name: string,
  gamePath: string,
  options: {
    username: string;
    uuid: string;
    accessToken?: string;
    javaPath?: string;
    server?: { host: string; port?: number };
  }
): Promise<{ requestId: string }> {
  return ipcInvoke<{ requestId: string }>('instance:launch', { name, gamePath, ...options });
}

export async function diagnoseInstance(
  name: string,
  gamePath: string
): Promise<{ healthy: boolean; issues: string[] }> {
  return ipcInvoke<{ healthy: boolean; issues: string[] }>('instance:diagnose', { name, gamePath });
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

export async function scanGameDir(gamePath: string): Promise<{ versions: ScannedVersion[] }> {
  return ipcInvoke<{ versions: ScannedVersion[] }>('instance:scan-dir', { gamePath });
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

export async function getForgeVersionList(mcVersion?: string) {
  return ipcInvoke<{ versions: string[] | Record<string, string[]> }>('instance:forge-version-list', { mcVersion });
}

export async function getFabricVersionList(mcVersion?: string) {
  return ipcInvoke<{ versions: string[] }>('instance:fabric-version-list', { mcVersion });
}

export async function getQuiltVersionList(mcVersion?: string) {
  return ipcInvoke<{ versions: string[] }>('instance:quilt-version-list', { mcVersion });
}

// Event listeners
export function onInstallProgress(callback: (data: { requestId: string } & InstallProgress) => void) {
  return onIpcEvent('instance:progress', callback);
}

export function onInstallComplete(callback: (data: { requestId: string; data: InstanceInfo }) => void) {
  return onIpcEvent('instance:install-complete', callback);
}

export function onInstallError(callback: (data: { requestId: string; error: string }) => void) {
  return onIpcEvent('instance:install-error', callback);
}

export function onLaunchEvent(callback: (data: { requestId: string; event: string; [key: string]: unknown }) => void) {
  return onIpcEvent('instance:launch-event', callback);
}

export function onLaunchComplete(callback: (data: { requestId: string; data: { pid: number; version: string; username: string } }) => void) {
  return onIpcEvent('instance:launch-complete', callback);
}

export function onLaunchError(callback: (data: { requestId: string; error: string }) => void) {
  return onIpcEvent('instance:launch-error', callback);
}
