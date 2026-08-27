import * as fs from 'fs';
import * as path from 'path';
import { Version, type ResolvedVersion } from '@xmcl/core';
import {
  install as xmclInstall,
  installForge,
  installFabric,
  installNeoForged,
  installOptifine,
  installQuiltVersion,
  installDependencies,
  getVersionList,
  getForgeVersionList as xmclGetForgeVersionList,
  getFabricLoaders,
  getQuiltLoaderVersionsByMinecraft,
} from '@xmcl/installer';
import { rewriteToMirror } from './installer';

// ==================== BMCLAPI 镜像源配置 ====================
// 版本清单（@xmcl/installer 的 getVersionList 通过 remote 参数覆盖）
export const BMCLAPI_VERSION_MANIFEST = 'https://bmclapi2.bangbang93.com/mc/game/version_manifest.json';
// Maven 仓库镜像（Libraries / Forge / NeoForge / Fabric 构件）
export const BMCLAPI_MAVEN = 'https://bmclapi2.bangbang93.com/maven';
// 资源文件镜像（assets）
export const BMCLAPI_ASSETS = 'https://bmclapi2.bangbang93.com/assets';

// 供 @xmcl/installer FetchOptions 使用的镜像 fetch（meta.fabricmc.net 等元数据接口走镜像）
export const mirrorFetch: typeof fetch = (url, init) => fetch(rewriteToMirror(String(url)), init);

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

const INSTANCE_CONFIG_FILE = 'instance.json';

function getInstanceConfigPath(instancePath: string): string {
  return path.join(instancePath, INSTANCE_CONFIG_FILE);
}

function countFiles(dir: string, ext?: string): number {
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir).filter((f) => {
    if (ext) return f.endsWith(ext);
    return fs.statSync(path.join(dir, f)).isFile();
  }).length;
}

function getInstanceIssues(instancePath: string, runtime: InstanceRuntime): string[] {
  const issues: string[] = [];

  if (!fs.existsSync(path.join(instancePath, 'versions', runtime.minecraft, `${runtime.minecraft}.json`))) {
    issues.push(`Version JSON not found for ${runtime.minecraft}`);
  }
  if (!fs.existsSync(path.join(instancePath, 'versions', runtime.minecraft, `${runtime.minecraft}.jar`))) {
    issues.push(`Client JAR not found for ${runtime.minecraft}`);
  }

  return issues;
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
  const instancePath = path.join(gamePath, 'instances', name);

  if (fs.existsSync(instancePath)) {
    throw new Error(`Instance already exists: ${name}`);
  }

  fs.mkdirSync(instancePath, { recursive: true });

  const now = Date.now();
  const config: InstanceConfig = {
    name,
    author: options?.author || '',
    description: options?.description || '',
    runtime,
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

  // Create standard directories
  for (const dir of ['mods', 'config', 'resourcepacks', 'shaderpacks', 'saves', 'screenshots', 'logs']) {
    fs.mkdirSync(path.join(instancePath, dir), { recursive: true });
  }

  return getInstanceInfo(name, gamePath);
}

export async function listInstances(gamePath: string): Promise<InstanceInfo[]> {
  const instancesPath = path.join(gamePath, 'instances');
  const instances: InstanceInfo[] = [];

  if (!fs.existsSync(instancesPath)) {
    return instances;
  }

  const entries = fs.readdirSync(instancesPath, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    try {
      instances.push(await getInstanceInfo(entry.name, gamePath));
    } catch {
      // Skip invalid instances
    }
  }

  return instances;
}

export async function getInstanceInfo(name: string, gamePath: string): Promise<InstanceInfo> {
  const instancePath = path.join(gamePath, 'instances', name);
  const configPath = getInstanceConfigPath(instancePath);

  if (!fs.existsSync(configPath)) {
    throw new Error(`Instance not found: ${name}`);
  }

  const configRaw = fs.readFileSync(configPath, 'utf-8');
  const config = JSON.parse(configRaw) as InstanceConfig;

  const issues = getInstanceIssues(instancePath, config.runtime);

  return {
    name,
    path: instancePath,
    config,
    modCount: countFiles(path.join(instancePath, 'mods'), '.jar'),
    resourcePackCount: countFiles(path.join(instancePath, 'resourcepacks'), '.zip'),
    screenshotCount: countFiles(path.join(instancePath, 'screenshots')),
    saveCount: countFiles(path.join(instancePath, 'saves')),
    healthy: issues.length === 0,
    issues,
  };
}

export async function deleteInstance(name: string, gamePath: string): Promise<{ deleted: string }> {
  const instancePath = path.join(gamePath, 'instances', name);

  if (!fs.existsSync(instancePath)) {
    throw new Error(`Instance not found: ${name}`);
  }

  fs.rmSync(instancePath, { recursive: true, force: true });
  return { deleted: name };
}

export async function updateInstance(
  name: string,
  gamePath: string,
  patch: Partial<Omit<InstanceConfig, 'name' | 'creationDate'>>
): Promise<InstanceInfo> {
  const instancePath = path.join(gamePath, 'instances', name);
  const configPath = getInstanceConfigPath(instancePath);

  if (!fs.existsSync(configPath)) {
    throw new Error(`Instance not found: ${name}`);
  }

  const configRaw = fs.readFileSync(configPath, 'utf-8');
  const config = JSON.parse(configRaw) as InstanceConfig;

  const updated = { ...config, ...patch };
  fs.writeFileSync(configPath, JSON.stringify(updated, null, 2), 'utf-8');

  return getInstanceInfo(name, gamePath);
}

export async function installInstanceGame(
  name: string,
  gamePath: string,
  callbacks?: { onProgress?: (progress: InstallProgress) => void }
): Promise<InstanceInfo> {
  const instance = await getInstanceInfo(name, gamePath);
  const { runtime } = instance.config;
  const instancePath = instance.path;

  callbacks?.onProgress?.({ stage: 'installing-minecraft', current: 0, total: 100, message: `Installing Minecraft ${runtime.minecraft}...` });

  // Install Minecraft
  // First get version list to find the version info（走 BMCLAPI 镜像）
  const versionList = await getVersionList({ remote: BMCLAPI_VERSION_MANIFEST, fetch: mirrorFetch });
  const versionInfo = versionList.versions.find((v) => v.id === runtime.minecraft);
  if (!versionInfo) {
    throw new Error(`Minecraft version ${runtime.minecraft} not found`);
  }
  await xmclInstall({ id: versionInfo.id, url: versionInfo.url }, instancePath, {
    // 版本 JSON / 客户端 JAR 走镜像（BMCLAPI 会回源官方地址）
    json: (v) => rewriteToMirror(v.url),
    client: (v) => (v.downloads.client ? rewriteToMirror(v.downloads.client.url) : []),
    mavenHost: BMCLAPI_MAVEN,
    assetsHost: BMCLAPI_ASSETS,
  });

  // Install mod loaders
  if (runtime.forge) {
    callbacks?.onProgress?.({ stage: 'installing-forge', current: 0, total: 100, message: `Installing Forge ${runtime.forge}...` });
    await installForge({ version: runtime.forge, mcversion: runtime.minecraft }, instancePath, { mavenHost: BMCLAPI_MAVEN });
  }

  if (runtime.fabricLoader) {
    callbacks?.onProgress?.({ stage: 'installing-fabric', current: 0, total: 100, message: `Installing Fabric ${runtime.fabricLoader}...` });
    await installFabric({
      minecraftVersion: runtime.minecraft,
      version: runtime.fabricLoader,
      minecraft: instancePath,
      fetch: mirrorFetch,
    });
  }

  if (runtime.quiltLoader) {
    callbacks?.onProgress?.({ stage: 'installing-quilt', current: 0, total: 100, message: `Installing Quilt ${runtime.quiltLoader}...` });
    await installQuiltVersion({
      minecraftVersion: runtime.minecraft,
      version: runtime.quiltLoader,
      minecraft: instancePath,
    });
  }

  if (runtime.neoForged) {
    callbacks?.onProgress?.({ stage: 'installing-neoforge', current: 0, total: 100, message: `Installing NeoForge ${runtime.neoForged}...` });
    await installNeoForged('neoforge', runtime.neoForged, instancePath, { mavenHost: BMCLAPI_MAVEN });
  }

  // Note: OptiFine requires downloading the installer JAR first
  // if (runtime.optifine) {
  //   callbacks?.onProgress?.({ stage: 'installing-optifine', current: 0, total: 100, message: `Installing OptiFine ${runtime.optifine}...` });
  //   await installOptifine(runtime.optifine, instancePath);
  // }

  callbacks?.onProgress?.({ stage: 'installing-dependencies', current: 0, total: 100, message: 'Installing dependencies...' });

  // Install all dependencies (libraries + assets)（走 BMCLAPI 镜像）
  const resolved: ResolvedVersion = await Version.parse(instancePath, runtime.minecraft);
  await installDependencies(resolved, { mavenHost: BMCLAPI_MAVEN, assetsHost: BMCLAPI_ASSETS });

  callbacks?.onProgress?.({ stage: 'done', current: 100, total: 100, message: 'Installation complete' });

  // Update last access date
  await updateInstance(name, gamePath, { lastAccessDate: Date.now() });

  return getInstanceInfo(name, gamePath);
}

export async function diagnoseInstance(
  name: string,
  gamePath: string
): Promise<{ healthy: boolean; issues: string[] }> {
  const instance = await getInstanceInfo(name, gamePath);
  return {
    healthy: instance.healthy,
    issues: instance.issues,
  };
}

// Version list APIs
export async function getMinecraftVersionList(type?: string) {
  // 版本清单一律走 BMCLAPI 镜像
  const manifest = await getVersionList({ remote: BMCLAPI_VERSION_MANIFEST, fetch: mirrorFetch });
  let versions = manifest.versions;
  if (type && type !== 'all') {
    versions = versions.filter((v: { type: string }) => v.type === type);
  }
  return { versions, latest: manifest.latest };
}

export async function getForgeVersionList(mcVersion?: string) {
  const list = await xmclGetForgeVersionList({ minecraft: mcVersion });
  return { versions: list.versions };
}

export async function getFabricVersionList(mcVersion?: string) {
  // Fabric 元数据走 BMCLAPI 镜像（meta.fabricmc.net → fabric-meta）
  if (mcVersion) {
    const loaders = await getFabricLoaders({ fetch: mirrorFetch });
    return { versions: loaders.map((l) => l.version) };
  }
  const loaders = await getFabricLoaders({ fetch: mirrorFetch });
  return { versions: loaders.map((l) => l.version) };
}

export async function getQuiltVersionList(mcVersion?: string) {
  const loaders = await getQuiltLoaderVersionsByMinecraft({ minecraftVersion: mcVersion || '*' });
  return { versions: loaders.map((l) => l.loader.version) };
}

// 扫描目录中已安装版本的信息
export interface ScannedVersion {
  id: string;
  type: string;
  releaseTime?: string;
  /** JAR 文件是否存在 */
  hasJar: boolean;
  /** JSON 文件是否存在 */
  hasJson: boolean;
  /** 检测到的 mod 加载器 */
  loaders: string[];
  /** 是否健康（JSON + JAR 都存在） */
  healthy: boolean;
}

// 从版本 JSON 中检测 mod 加载器
function detectLoaders(jsonPath: string): string[] {
  const loaders: string[] = [];
  try {
    const raw = fs.readFileSync(jsonPath, 'utf-8');
    const json = JSON.parse(raw);
    const libs: { name?: string }[] = json.libraries || [];
    for (const lib of libs) {
      const name = lib.name || "";
      if (name.startsWith("net.minecraftforge:forge:") || name.startsWith("net.neoforged:")) {
        if (!loaders.includes("forge")) loaders.push("forge");
      } else if (name.startsWith("net.fabricmc:yarn:") || name.startsWith("net.fabricmc:fabric-loader:")) {
        if (!loaders.includes("fabric")) loaders.push("fabric");
      } else if (name.startsWith("org.quiltmc:quilt-loader:")) {
        if (!loaders.includes("quilt")) loaders.push("quilt");
      } else if (name.startsWith("optifine:OptiFine:")) {
        if (!loaders.includes("optifine")) loaders.push("optifine");
      }
    }
  } catch {}
  return loaders;
}

// 扫描指定目录，返回 versions 子目录中所有已安装版本的详细信息
export function scanGameDirectories(gamePath: string): ScannedVersion[] {
  const versionsPath = path.join(gamePath, 'versions');
  if (!fs.existsSync(versionsPath)) return [];
  try {
    return fs.readdirSync(versionsPath, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => {
        const id = e.name;
        const versionDir = path.join(versionsPath, id);
        const jsonPath = path.join(versionDir, `${id}.json`);
        const jarPath = path.join(versionDir, `${id}.jar`);
        const hasJson = fs.existsSync(jsonPath);
        const hasJar = fs.existsSync(jarPath);

        let type = "unknown";
        let releaseTime: string | undefined;

        if (hasJson) {
          try {
            const raw = fs.readFileSync(jsonPath, 'utf-8');
            const json = JSON.parse(raw);
            type = json.type || "unknown";
            releaseTime = json.releaseTime;
          } catch {}
        }

        const loaders = hasJson ? detectLoaders(jsonPath) : [];
        const healthy = hasJson && hasJar;

        return { id, type, releaseTime, hasJar, hasJson, loaders, healthy };
      });
  } catch {
    return [];
  }
}

// 从已安装版本导入实例（不下载，直接复制版本文件）
export async function importExistingInstance(
  name: string,
  gamePath: string,
  versionId: string,
  options?: {
    description?: string;
    java?: string;
    minMemory?: number;
    maxMemory?: number;
    /** 版本文件来源目录（默认 = gamePath）；扫描副目录导入时传 scanTarget */
    sourceGamePath?: string;
  }
): Promise<InstanceInfo> {
  const instancePath = path.join(gamePath, 'instances', name);
  if (fs.existsSync(instancePath)) {
    throw new Error(`Instance already exists: ${name}`);
  }

  // 源版本目录：默认取 gamePath，扫描副目录时取 sourceGamePath
  const srcGamePath = options?.sourceGamePath || gamePath;
  const srcVersionDir = path.join(srcGamePath, 'versions', versionId);
  if (!fs.existsSync(srcVersionDir)) {
    throw new Error(`Version directory not found: ${versionId}（来源：${srcGamePath}）`);
  }

  // 读取源版本 JSON 获取类型信息
  const srcJsonPath = path.join(srcVersionDir, `${versionId}.json`);
  if (!fs.existsSync(srcJsonPath)) {
    throw new Error(`Version JSON not found: ${versionId}`);
  }

  let type = "release";
  let releaseTime: string | undefined;
  try {
    const raw = fs.readFileSync(srcJsonPath, 'utf-8');
    const json = JSON.parse(raw);
    type = json.type || "release";
    releaseTime = json.releaseTime;
  } catch {}

  // 构建 InstanceRuntime
  const runtime: InstanceRuntime = {
    minecraft: versionId,
  };

  // 从 JSON 中检测加载器并填充 runtime
  try {
    const raw = fs.readFileSync(srcJsonPath, 'utf-8');
    const json = JSON.parse(raw);
    const libs: { name?: string }[] = json.libraries || [];
    for (const lib of libs) {
      const name = lib.name || "";
      // Forge: net.minecraftforge:forge:1.20.1-47.2.0
      const forgeMatch = name.match(/^net\.minecraftforge:forge:([\d.]+(?:-\d+(?:\.\d+)*)?)/);
      if (forgeMatch) { runtime.forge = forgeMatch[1]; continue; }
      // NeoForge: net.neoforged:neoforge:21.0.0
      const neoMatch = name.match(/^net\.neoforged:neoforge:([\d.]+)/);
      if (neoMatch) { runtime.neoForged = neoMatch[1]; continue; }
      // Fabric: net.fabricmc:fabric-loader:0.15.11
      const fabricMatch = name.match(/^net\.fabricmc:fabric-loader:([\d.]+)/);
      if (fabricMatch) { runtime.fabricLoader = fabricMatch[1]; continue; }
      // Quilt: org.quiltmc:quilt-loader:0.26.0
      const quiltMatch = name.match(/^org\.quiltmc:quilt-loader:([\d.]+)/);
      if (quiltMatch) { runtime.quiltLoader = quiltMatch[1]; continue; }
    }
  } catch {}

  // 创建实例目录结构
  fs.mkdirSync(instancePath, { recursive: true });

  const now = Date.now();
  const config: InstanceConfig = {
    name,
    author: '',
    description: options?.description || `Imported from version ${versionId}`,
    runtime,
    java: options?.java,
    minMemory: options?.minMemory,
    maxMemory: options?.maxMemory,
    creationDate: now,
    lastAccessDate: now,
    lastPlayedDate: 0,
    playtime: 0,
  };

  fs.writeFileSync(getInstanceConfigPath(instancePath), JSON.stringify(config, null, 2), 'utf-8');

  // 创建标准子目录
  for (const dir of ['mods', 'config', 'resourcepacks', 'shaderpacks', 'saves', 'screenshots', 'logs']) {
    fs.mkdirSync(path.join(instancePath, dir), { recursive: true });
  }

  // 复制版本文件到实例目录
  const destVersionDir = path.join(instancePath, 'versions', versionId);
  fs.mkdirSync(destVersionDir, { recursive: true });

  // 复制所有版本文件
  const files = fs.readdirSync(srcVersionDir);
  for (const file of files) {
    const srcFile = path.join(srcVersionDir, file);
    const destFile = path.join(destVersionDir, file);
    if (fs.statSync(srcFile).isFile()) {
      fs.copyFileSync(srcFile, destFile);
    }
  }

  return getInstanceInfo(name, gamePath);
}
