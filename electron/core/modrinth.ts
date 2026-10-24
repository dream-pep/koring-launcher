import electron from 'electron';
import * as fs from 'fs';
import * as path from 'path';

const { net } = electron;

const MODRINTH_API = 'https://api.modrinth.com/v2';
const CURSEFORGE_API = 'https://api.curseforge.com/v1';

interface ModSearchResult {
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
  /** 以下为列表页/详情页展示用的补充字段 */
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

/** Modrinth 搜索排序方式 */
export type ModSearchIndex = 'relevance' | 'downloads' | 'follows' | 'newest' | 'updated';

interface ModSearchResponse {
  hits: ModSearchResult[];
  total: number;
  limit: number;
  offset: number;
}

interface ModCategory {
  name: string;
  label: string;
  projectType: string;
}

interface ModVersionResult {
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

async function searchModrinth(
  query?: string,
  gameVersion?: string,
  loader?: string,
  category?: string,
  projectType: string = 'mod',
  limit: number = 20,
  offset: number = 0,
  index: ModSearchIndex = 'relevance'
): Promise<ModSearchResponse> {
  const facets: string[][] = [];
  if (gameVersion) facets.push([`versions:${gameVersion}`]);
  if (loader) facets.push([`categories:${loader}`]);
  if (category) facets.push([`categories:${category}`]);

  const params = new URLSearchParams({
    query: query || '',
    limit: String(limit),
    offset: String(offset),
    index,
    project_type: projectType,
  });

  if (facets.length > 0) {
    params.set('facets', JSON.stringify(facets));
  }

  const response = await net.fetch(`${MODRINTH_API}/search?${params.toString()}`);
  if (!response.ok) throw new Error(`Modrinth search failed: ${response.status}`);

  const data = await response.json() as {
    total_hits: number;
    hits: Array<{
      project_id: string;
      project_type?: string;
      slug: string;
      title: string;
      description: string;
      downloads: number;
      follows?: number;
      author?: string;
      icon_url?: string;
      categories?: string[];
      versions?: string[];
      latest_version?: string;
      license?: string;
      gallery?: string[];
      featured_gallery?: string | null;
      color?: number | null;
      client_side?: string;
      server_side?: string;
      date_created?: string;
      date_modified?: string;
    }>;
  };

  return {
    hits: data.hits.map((hit) => ({
      id: hit.project_id,
      slug: hit.slug,
      name: hit.title,
      description: hit.description,
      downloads: hit.downloads,
      iconUrl: hit.icon_url,
      categories: hit.categories,
      versions: hit.versions,
      source: 'modrinth' as const,
      author: hit.author,
      projectType: hit.project_type,
      follows: hit.follows,
      latestVersion: hit.latest_version,
      license: hit.license,
      gallery: hit.gallery,
      featuredGallery: hit.featured_gallery ?? undefined,
      color: hit.color,
      clientSide: hit.client_side,
      serverSide: hit.server_side,
      dateCreated: hit.date_created,
      dateModified: hit.date_modified,
    })),
    total: data.total_hits,
    limit,
    offset,
  };
}

async function searchCurseForge(
  query?: string,
  gameVersion?: string,
  loader?: string,
  limit: number = 20,
  offset: number = 0
): Promise<ModSearchResponse> {
  // CurseForge requires API key - return empty for now
  return { hits: [], total: 0, limit, offset };
}

export async function searchMods(
  query?: string,
  gameVersion?: string,
  loader?: string,
  category?: string,
  projectType: string = 'mod',
  limit?: number,
  offset?: number,
  source: 'modrinth' | 'curseforge' = 'modrinth',
  index: ModSearchIndex = 'relevance'
): Promise<ModSearchResponse> {
  if (source === 'modrinth') {
    return searchModrinth(query, gameVersion, loader, category, projectType, limit, offset, index);
  }
  return searchCurseForge(query, gameVersion, loader, limit, offset);
}

export async function getCategories(projectType: string = 'mod'): Promise<ModCategory[]> {
  const response = await net.fetch(`${MODRINTH_API}/tag/category`);
  if (!response.ok) throw new Error(`Modrinth categories failed: ${response.status}`);

  const data = await response.json() as Array<{
    name: string;
    project_type: string;
    header: string;
  }>;

  // 只返回指定类型分类，label 优先取 header（国际化标题），无则用 name
  return data
    .filter((c) => c.project_type === projectType)
    .map((c) => ({ name: c.name, label: c.header || c.name, projectType: c.project_type }));
}

export async function getGameVersions(): Promise<string[]> {
  const response = await net.fetch(`${MODRINTH_API}/tag/game_version`);
  if (!response.ok) throw new Error(`Modrinth game versions failed: ${response.status}`);

  const data = await response.json() as string[];
  // 只保留正式版（1.x 且非预览版），并按版本号倒序
  return data
    .filter((v) => /^\d+\.\d+(\.\d+)?$/.test(v))
    .sort((a, b) => {
      const pa = a.split('.').map(Number);
      const pb = b.split('.').map(Number);
      for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const diff = (pb[i] || 0) - (pa[i] || 0);
        if (diff !== 0) return diff;
      }
      return 0;
    });
}

export async function getModDetail(
  projectId: string,
  source: 'modrinth' | 'curseforge' = 'modrinth'
): Promise<ModSearchResult> {
  if (source === 'modrinth') {
    const response = await net.fetch(`${MODRINTH_API}/project/${projectId}`);
    if (!response.ok) throw new Error(`Modrinth detail failed: ${response.status}`);

    const data = await response.json() as {
      id: string;
      slug: string;
      title: string;
      description: string;
      project_type?: string;
      downloads: number;
      followers?: number;
      icon_url?: string;
      categories?: string[];
      versions?: string[];
      license?: { id?: string; name?: string };
      gallery?: Array<{ url: string; featured?: boolean }>;
      color?: number | null;
      client_side?: string;
      server_side?: string;
      published?: string;
      updated?: string;
    };

    const galleries = data.gallery ?? [];

    return {
      id: data.id,
      slug: data.slug,
      name: data.title,
      description: data.description,
      downloads: data.downloads,
      iconUrl: data.icon_url,
      categories: data.categories,
      versions: data.versions,
      source: 'modrinth',
      projectType: data.project_type,
      follows: data.followers,
      latestVersion: data.versions?.[0],
      license: data.license?.name ?? data.license?.id,
      gallery: galleries.map((item) => item.url),
      featuredGallery: galleries.find((item) => item.featured)?.url,
      color: data.color,
      clientSide: data.client_side,
      serverSide: data.server_side,
      dateCreated: data.published,
      dateModified: data.updated,
    };
  }

  throw new Error(`CurseForge detail not implemented`);
}

export async function getModVersions(
  projectId: string,
  gameVersion?: string,
  loader?: string,
  source: 'modrinth' | 'curseforge' = 'modrinth'
): Promise<ModVersionResult[]> {
  if (source === 'modrinth') {
    const params = new URLSearchParams();
    if (gameVersion) params.set('game_versions', JSON.stringify([gameVersion]));
    if (loader) params.set('loaders', JSON.stringify([loader]));

    const response = await net.fetch(`${MODRINTH_API}/project/${projectId}/version?${params.toString()}`);
    if (!response.ok) throw new Error(`Modrinth versions failed: ${response.status}`);

    const data = await response.json() as Array<{
      id: string;
      name: string;
      version_number: string;
      game_versions: string[];
      loaders: string[];
      files: Array<{
        filename: string;
        url: string;
        size: number;
        primary: boolean;
      }>;
    }>;

    return data.map((v) => ({
      id: v.id,
      name: v.name,
      versionNumber: v.version_number,
      gameVersions: v.game_versions,
      loaders: v.loaders,
      files: v.files.map((f) => ({
        filename: f.filename,
        url: f.url,
        size: f.size,
        primary: f.primary,
      })),
    }));
  }

  throw new Error(`CurseForge versions not implemented`);
}

export async function installMod(
  projectId: string,
  versionId: string | undefined,
  gamePath: string,
  source: 'modrinth' | 'curseforge' = 'modrinth'
): Promise<{ projectId: string; versionId: string; filename: string; path: string }> {
  const versions = await getModVersions(projectId, undefined, undefined, source);
  const targetVersion = versionId
    ? versions.find((v) => v.id === versionId)
    : versions[0];

  if (!targetVersion) throw new Error('No version found');

  const primaryFile = targetVersion.files.find((f) => f.primary) || targetVersion.files[0];
  if (!primaryFile) throw new Error('No file found');

  // Download the mod file
  const modsDir = path.join(gamePath, 'mods');
  if (!fs.existsSync(modsDir)) {
    fs.mkdirSync(modsDir, { recursive: true });
  }

  const filePath = path.join(modsDir, primaryFile.filename);
  const response = await net.fetch(primaryFile.url);
  if (!response.ok) throw new Error(`Download failed: ${response.status}`);

  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(filePath, buffer);

  return {
    projectId,
    versionId: targetVersion.id,
    filename: primaryFile.filename,
    path: filePath,
  };
}
