import { ipcInvoke } from './ipc';

export interface VersionInfo {
  id: string;
  type: string;
  url: string;
}

export interface VersionManifest {
  latest: { release: string; snapshot: string };
  versions: VersionInfo[];
}

export async function getVersionList(type?: string): Promise<VersionManifest> {
  return ipcInvoke<VersionManifest>('install:version-list', { type });
}

export async function installMinecraft(
  version: string,
  gamePath: string,
  javaPath?: string,
  downloadThreads?: number
): Promise<{ version: string; gamePath: string }> {
  return ipcInvoke('install:minecraft', {
    version,
    gamePath,
    javaPath,
    downloadThreads,
  });
}

export async function installModLoader(
  mcVersion: string,
  gamePath: string,
  loaderType: 'forge' | 'fabric' | 'quilt' | 'neoforge',
  loaderVersion?: string,
  javaPath?: string
): Promise<{ loaderType: string; mcVersion: string; loaderVersion: string }> {
  return ipcInvoke('install:mod-loader', {
    mcVersion,
    gamePath,
    loaderType,
    loaderVersion,
    javaPath,
  });
}

export async function getForgeVersions(mcVersion?: string) {
  return ipcInvoke('install:forge-version-list', { mcVersion });
}

export async function getFabricVersions(mcVersion?: string) {
  return ipcInvoke('install:fabric-version-list', { mcVersion });
}
