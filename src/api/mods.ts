import { ipcInvoke } from './ipc';

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
}

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
  source: 'modrinth' | 'curseforge' = 'modrinth'
): Promise<ModSearchResponse> {
  return ipcInvoke<ModSearchResponse>('mods:search', {
    query,
    gameVersion,
    loader,
    category,
    projectType,
    limit,
    offset,
    source,
  });
}

export async function getCategories(projectType: string = "mod"): Promise<ModCategory[]> {
  return ipcInvoke<ModCategory[]>('mods:categories', { projectType });
}

export async function getGameVersions(): Promise<string[]> {
  return ipcInvoke<string[]>('mods:game-versions');
}

export async function getModDetail(
  projectId: string,
  source: 'modrinth' | 'curseforge'
): Promise<ModSearchResult> {
  return ipcInvoke<ModSearchResult>('mods:detail', { projectId, source });
}

export async function getModVersions(
  projectId: string,
  gameVersion?: string,
  loader?: string,
  source: 'modrinth' | 'curseforge' = 'modrinth'
): Promise<ModVersionResult[]> {
  return ipcInvoke<ModVersionResult[]>('mods:versions', {
    projectId,
    gameVersion,
    loader,
    source,
  });
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
