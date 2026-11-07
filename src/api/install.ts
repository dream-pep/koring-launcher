import { ipcInvoke } from './ipc';
import { CACHE_TTL, cacheKey, cached, invalidate } from '../lib/data-cache';

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
  return cached(cacheKey('versions:manifest', type ?? 'all'), CACHE_TTL.long, () =>
    ipcInvoke<VersionManifest>('install:version-list', { type }),
  );
}

export async function installMinecraft(
  version: string,
  gamePath: string,
  javaPath?: string,
  downloadThreads?: number
): Promise<{ version: string; gamePath: string }> {
  const result = await ipcInvoke<{ version: string; gamePath: string }>('install:minecraft', {
    version,
    gamePath,
    javaPath,
    downloadThreads,
  });
  // 新装的版本会让「已安装版本 / 实例依赖」列表过期
  invalidate('instances:');
  invalidate('versions:');
  return result;
}

export async function installModLoader(
  mcVersion: string,
  gamePath: string,
  loaderType: 'forge' | 'fabric' | 'quilt' | 'neoforge',
  loaderVersion?: string,
  javaPath?: string
): Promise<{ loaderType: string; mcVersion: string; loaderVersion: string }> {
  const result = await ipcInvoke<{ loaderType: string; mcVersion: string; loaderVersion: string }>(
    'install:mod-loader',
    {
      mcVersion,
      gamePath,
      loaderType,
      loaderVersion,
      javaPath,
    },
  );
  invalidate('instances:');
  invalidate('versions:');
  return result;
}

export async function getForgeVersions(mcVersion?: string) {
  return cached(cacheKey('versions:forge-install', mcVersion ?? 'all'), CACHE_TTL.long, () =>
    ipcInvoke('install:forge-version-list', { mcVersion }),
  );
}

export async function getFabricVersions(mcVersion?: string) {
  return cached(cacheKey('versions:fabric-install', mcVersion ?? 'all'), CACHE_TTL.long, () =>
    ipcInvoke('install:fabric-version-list', { mcVersion }),
  );
}
