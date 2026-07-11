import * as fs from 'fs';
import * as path from 'path';
import { MinecraftFolder, Version, launch, createMinecraftProcessWatcher, type ResolvedVersion } from '@xmcl/core';
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
  // First get version list to find the version info
  const versionList = await getVersionList();
  const versionInfo = versionList.versions.find((v) => v.id === runtime.minecraft);
  if (!versionInfo) {
    throw new Error(`Minecraft version ${runtime.minecraft} not found`);
  }
  await xmclInstall({ id: versionInfo.id, url: versionInfo.url }, instancePath);

  // Install mod loaders
  if (runtime.forge) {
    callbacks?.onProgress?.({ stage: 'installing-forge', current: 0, total: 100, message: `Installing Forge ${runtime.forge}...` });
    await installForge({ version: runtime.forge, mcversion: runtime.minecraft }, instancePath);
  }

  if (runtime.fabricLoader) {
    callbacks?.onProgress?.({ stage: 'installing-fabric', current: 0, total: 100, message: `Installing Fabric ${runtime.fabricLoader}...` });
    await installFabric({
      minecraftVersion: runtime.minecraft,
      version: runtime.fabricLoader,
      minecraft: instancePath,
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
    await installNeoForged('neoforge', runtime.neoForged, instancePath, {});
  }

  // Note: OptiFine requires downloading the installer JAR first
  // if (runtime.optifine) {
  //   callbacks?.onProgress?.({ stage: 'installing-optifine', current: 0, total: 100, message: `Installing OptiFine ${runtime.optifine}...` });
  //   await installOptifine(runtime.optifine, instancePath);
  // }

  callbacks?.onProgress?.({ stage: 'installing-dependencies', current: 0, total: 100, message: 'Installing dependencies...' });

  // Install all dependencies (libraries + assets)
  const resolved: ResolvedVersion = await Version.parse(instancePath, runtime.minecraft);
  await installDependencies(resolved);

  callbacks?.onProgress?.({ stage: 'done', current: 100, total: 100, message: 'Installation complete' });

  // Update last access date
  await updateInstance(name, gamePath, { lastAccessDate: Date.now() });

  return getInstanceInfo(name, gamePath);
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
    onEvent?: (event: { event: string; [key: string]: unknown }) => void;
  }
): Promise<{ pid: number; version: string; username: string }> {
  const instance = await getInstanceInfo(name, gamePath);
  const { runtime } = instance.config;

  const resolved: ResolvedVersion = await Version.parse(instance.path, runtime.minecraft);

  const javaPath = options.javaPath || instance.config.java || 'java';

  const mcProcess = await launch({
    gameProfile: {
      id: options.uuid,
      name: options.username,
    },
    javaPath,
    version: resolved,
    gamePath: instance.path,
    minMemory: instance.config.minMemory || 1024,
    maxMemory: instance.config.maxMemory || 4096,
    extraExecOption: { detached: true, stdio: 'ignore' },
    server: options.server ? { ip: options.server.host, port: options.server.port } : undefined,
  });

  const watcher = createMinecraftProcessWatcher(mcProcess);

  watcher.on('minecraft-window-ready', () => {
    options.onEvent?.({ event: 'window-ready' });
  });

  watcher.on('minecraft-exit', ({ code }) => {
    options.onEvent?.({ event: 'exit', code });
  });

  // Update playtime tracking
  const startTime = Date.now();
  mcProcess.on('exit', async () => {
    const elapsed = Date.now() - startTime;
    try {
      const info = await getInstanceInfo(name, gamePath);
      await updateInstance(name, gamePath, {
        lastPlayedDate: Date.now(),
        playtime: (info.config.playtime || 0) + elapsed,
      });
    } catch {
      // Ignore errors during playtime update
    }
  });

  // Update last access date
  await updateInstance(name, gamePath, { lastAccessDate: Date.now() });

  return {
    pid: mcProcess.pid || 0,
    version: runtime.minecraft,
    username: options.username,
  };
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
  const manifest = await getVersionList();
  let versions = manifest.versions;
  if (type && type !== 'all') {
    versions = versions.filter((v) => v.type === type);
  }
  return { versions };
}

export async function getForgeVersionList(mcVersion?: string) {
  const list = await xmclGetForgeVersionList({ minecraft: mcVersion });
  return { versions: list.versions };
}

export async function getFabricVersionList(mcVersion?: string) {
  if (mcVersion) {
    const loaders = await getFabricLoaders();
    return { versions: loaders.map((l) => l.version) };
  }
  const loaders = await getFabricLoaders();
  return { versions: loaders.map((l) => l.version) };
}

export async function getQuiltVersionList(mcVersion?: string) {
  const loaders = await getQuiltLoaderVersionsByMinecraft({ minecraftVersion: mcVersion || '*' });
  return { versions: loaders.map((l) => l.loader.version) };
}
