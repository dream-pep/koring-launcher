import * as fs from 'fs';
import * as path from 'path';

interface InstanceConfig {
  name: string;
  mcVersion: string;
  loaderType?: string;
  loaderVersion?: string;
  javaPath?: string;
  memory?: { min?: string; max?: string };
  createdAt: string;
}

interface InstanceInfo {
  name: string;
  path: string;
  config: InstanceConfig;
  modCount?: number;
}

const INSTANCE_CONFIG_FILE = 'koring-instance.json';

function getInstanceConfigPath(instancePath: string): string {
  return path.join(instancePath, INSTANCE_CONFIG_FILE);
}

export async function createInstance(
  name: string,
  gamePath: string,
  mcVersion: string,
  loaderType?: string,
  loaderVersion?: string,
  javaPath?: string,
  memory?: { min?: string; max?: string }
): Promise<InstanceInfo> {
  const instancePath = path.join(gamePath, 'instances', name);

  if (!fs.existsSync(instancePath)) {
    fs.mkdirSync(instancePath, { recursive: true });
  }

  const config: InstanceConfig = {
    name,
    mcVersion,
    loaderType,
    loaderVersion,
    javaPath,
    memory,
    createdAt: new Date().toISOString(),
  };

  const configPath = getInstanceConfigPath(instancePath);
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');

  // Create mods directory
  const modsDir = path.join(instancePath, 'mods');
  if (!fs.existsSync(modsDir)) {
    fs.mkdirSync(modsDir, { recursive: true });
  }

  // Count mods
  const mods = fs.readdirSync(modsDir).filter((f) => f.endsWith('.jar'));

  return {
    name,
    path: instancePath,
    config,
    modCount: mods.length,
  };
}

export async function listInstances(instancesPath: string): Promise<InstanceInfo[]> {
  const instances: InstanceInfo[] = [];

  if (!fs.existsSync(instancesPath)) {
    return instances;
  }

  const entries = fs.readdirSync(instancesPath, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const instancePath = path.join(instancesPath, entry.name);
    const configPath = getInstanceConfigPath(instancePath);

    if (!fs.existsSync(configPath)) continue;

    try {
      const configRaw = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(configRaw) as InstanceConfig;

      // Count mods
      const modsDir = path.join(instancePath, 'mods');
      let modCount = 0;
      if (fs.existsSync(modsDir)) {
        modCount = fs.readdirSync(modsDir).filter((f) => f.endsWith('.jar')).length;
      }

      instances.push({
        name: entry.name,
        path: instancePath,
        config,
        modCount,
      });
    } catch {
      // Skip invalid config
    }
  }

  return instances;
}

export async function deleteInstance(
  name: string,
  instancesPath: string
): Promise<{ deleted: string }> {
  const instancePath = path.join(instancesPath, name);

  if (fs.existsSync(instancePath)) {
    fs.rmSync(instancePath, { recursive: true, force: true });
  }

  return { deleted: name };
}

export async function getInstanceInfo(
  name: string,
  instancesPath: string
): Promise<InstanceInfo> {
  const instancePath = path.join(instancesPath, name);
  const configPath = getInstanceConfigPath(instancePath);

  if (!fs.existsSync(configPath)) {
    throw new Error(`Instance not found: ${name}`);
  }

  const configRaw = fs.readFileSync(configPath, 'utf-8');
  const config = JSON.parse(configRaw) as InstanceConfig;

  // Count mods
  const modsDir = path.join(instancePath, 'mods');
  let modCount = 0;
  if (fs.existsSync(modsDir)) {
    modCount = fs.readdirSync(modsDir).filter((f) => f.endsWith('.jar')).length;
  }

  return {
    name,
    path: instancePath,
    config,
    modCount,
  };
}
