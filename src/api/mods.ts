import { ipcInvoke } from './ipc';
import { CACHE_TTL, cacheKey, cached } from '../lib/data-cache';

export interface ModSearchResult {
  id: string;
  slug: string;
  name: string;
  description: string;
  downloads: number;
  iconUrl?: string;
  categories?: string[];
  versions?: string[];
  loaders?: string[];
  source: 'modrinth' | 'curseforge';
  /** 以下为列表 / 详情页展示用的补充字段 */
  author?: string;
  projectType?: string;
  follows?: number;
  latestVersion?: string;
  license?: string;
  gallery?: string[];
  featuredGallery?: string;
  color?: number | null;
  clientSide?: string;
  serverSide?: string;
  dateCreated?: string;
  dateModified?: string;
}

/** 搜索排序方式 */
export type ModSearchIndex = 'relevance' | 'downloads' | 'follows' | 'newest' | 'updated';

/** 内容类型：模组 / 整合包 / 资源包 / 光影 */
export type ModProjectType = 'mod' | 'modpack' | 'resourcepack' | 'shader';

export interface ModSearchResponse {
  hits: ModSearchResult[];
  total: number;
  limit: number;
  offset: number;
}

export interface ModCategory {
  name: string;
  label: string;
  projectType: string;
}

export interface ModVersionResult {
  id: string;
  name: string;
  versionNumber: string;
  gameVersions: string[];
  loaders: string[];
  files: {
    filename: string;
    url: string;
    size: number;
    primary: boolean;
  }[];
}

export async function searchMods(
  query?: string,
  gameVersion?: string,
  loader?: string,
  category?: string,
  projectType: string = "mod",
  limit?: number,
  offset?: number,
  source: 'modrinth' | 'curseforge' = 'modrinth',
  index: ModSearchIndex = 'relevance'
): Promise<ModSearchResponse> {
  const params = {
    query,
    gameVersion,
    loader,
    category,
    projectType,
    limit,
    offset,
    source,
    index,
  };
  return cached(cacheKey('mods:search', params), CACHE_TTL.medium, () =>
    ipcInvoke<ModSearchResponse>('mods:search', params),
  );
}

export async function getCategories(projectType: string = "mod"): Promise<ModCategory[]> {
  return cached(cacheKey('mods:categories', projectType), CACHE_TTL.long, () =>
    ipcInvoke<ModCategory[]>('mods:categories', { projectType }),
  );
}

export async function getGameVersions(): Promise<string[]> {
  return cached('mods:game-versions', CACHE_TTL.long, () =>
    ipcInvoke<string[]>('mods:game-versions'),
  );
}

export async function getModDetail(
  projectId: string,
  source: 'modrinth' | 'curseforge'
): Promise<ModSearchResult> {
  return cached(cacheKey('mods:detail', projectId, source), CACHE_TTL.long, () =>
    ipcInvoke<ModSearchResult>('mods:detail', { projectId, source }),
  );
}

export async function getModVersions(
  projectId: string,
  gameVersion?: string,
  loader?: string,
  source: 'modrinth' | 'curseforge' = 'modrinth'
): Promise<ModVersionResult[]> {
  return cached(cacheKey('mods:versions', projectId, gameVersion, loader, source), CACHE_TTL.medium, () =>
    ipcInvoke<ModVersionResult[]>('mods:versions', {
      projectId,
      gameVersion,
      loader,
      source,
    }),
  );
}

export async function installMod(
  projectId: string,
  versionId: string | undefined,
  gamePath: string,
  source: 'modrinth' | 'curseforge' = 'modrinth'
): Promise<{ projectId: string; versionId: string; filename: string; path: string }> {
  return ipcInvoke('mods:install', {
    projectId,
    versionId,
    gamePath,
    source,
  });
}
