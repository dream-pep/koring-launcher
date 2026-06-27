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
  limit: number = 20,
  offset: number = 0
): Promise<ModSearchResult[]> {
  const facets: string[][] = [];
  if (gameVersion) facets.push([`versions:${gameVersion}`]);
  if (loader) facets.push([`categories:${loader}`]);

  const params = new URLSearchParams({
    query: query || '',
    limit: String(limit),
    offset: String(offset),
  });

  if (facets.length > 0) {
    params.set('facets', JSON.stringify(facets));
  }

  const response = await net.fetch(`${MODRINTH_API}/search?${params.toString()}`);
  if (!response.ok) throw new Error(`Modrinth search failed: ${response.status}`);

  const data = await response.json() as { hits: Array<{
    project_id: string;
    slug: string;
    title: string;
    description: string;
    downloads: number;
    icon_url?: string;
    categories?: string[];
    versions?: string[];
    client_side?: string;
    server_side?: string;
  }> };

  return data.hits.map((hit) => ({
    id: hit.project_id,
    slug: hit.slug,
    name: hit.title,
    description: hit.description,
    downloads: hit.downloads,
    iconUrl: hit.icon_url,
    categories: hit.categories,
    versions: hit.versions,
    source: 'modrinth' as const,
  }));
}

async function searchCurseForge(
  query?: string,
  gameVersion?: string,
  loader?: string,
  limit: number = 20,
  offset: number = 0
): Promise<ModSearchResult[]> {
  // CurseForge requires API key - return empty for now
  return [];
}

export async function searchMods(
  query?: string,
  gameVersion?: string,
  loader?: string,
  limit?: number,
  offset?: number,
  source: 'modrinth' | 'curseforge' = 'modrinth'
): Promise<ModSearchResult[]> {
  if (source === 'modrinth') {
    return searchModrinth(query, gameVersion, loader, limit, offset);
  }
  return searchCurseForge(query, gameVersion, loader, limit, offset);
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
      downloads: number;
      icon_url?: string;
      categories?: string[];
      versions?: string[];
    };

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
