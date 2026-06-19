import { join } from "path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";

export function ensureDir(dir: string) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function getMinecraftPath(gamePath: string) {
  return gamePath;
}

export function getVersionPath(gamePath: string, versionId: string) {
  return join(gamePath, "versions", versionId);
}

export function getVersionJsonPath(gamePath: string, versionId: string) {
  return join(getVersionPath(gamePath, versionId), `${versionId}.json`);
}

export function getLibrariesPath(gamePath: string) {
  return join(gamePath, "libraries");
}

export function getAssetsPath(gamePath: string) {
  return join(gamePath, "assets");
}

export function getInstancesPath(instancesPath: string) {
  return instancesPath;
}

export function getInstancePath(instancesPath: string, name: string) {
  return join(instancesPath, name);
}

export interface InstanceConfig {
  name: string;
  mcVersion: string;
  loaderType?: string;
  loaderVersion?: string;
  javaPath?: string;
  memory?: { min?: string; max?: string };
  createdAt: string;
}

export function readInstanceConfig(instancePath: string): InstanceConfig | null {
  const configPath = join(instancePath, "koring-instance.json");
  if (!existsSync(configPath)) return null;
  try {
    return JSON.parse(readFileSync(configPath, "utf-8"));
  } catch {
    return null;
  }
}

export function writeInstanceConfig(instancePath: string, config: InstanceConfig) {
  const configPath = join(instancePath, "koring-instance.json");
  writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
}
