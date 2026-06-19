import { ModrinthV2Client, type SearchResultHit, type ProjectVersion, type Project } from "@xmcl/modrinth";
import { CurseforgeV1Client } from "@xmcl/curseforge";
import { sendProgress } from "../protocol/transport.js";

const modrinth = new ModrinthV2Client();
const curseforge = new CurseforgeV1Client("");

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
  source: "modrinth" | "curseforge";
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
  limit: number = 20,
  offset: number = 0,
  source: "modrinth" | "curseforge" = "modrinth"
): Promise<ModSearchResult[]> {
  if (source === "modrinth") {
    const facets: string[] = [];
    if (gameVersion) facets.push(`versions:${gameVersion}`);
    if (loader) facets.push(`categories:${loader}`);

    const result = await modrinth.searchProjects({
      query: query || "",
      limit,
      offset,
      facets: facets.length > 0 ? JSON.stringify([facets]) : undefined,
    });

    return result.hits.map((hit: SearchResultHit) => ({
      id: hit.project_id,
      slug: hit.slug,
      name: hit.title,
      description: hit.description,
      downloads: hit.downloads,
      iconUrl: hit.icon_url,
      categories: hit.categories,
      versions: hit.versions,
      source: "modrinth" as const,
    }));
  }

  // CurseForge
  const result = await curseforge.searchMods({
    gameId: 432,
    classId: 6,
    searchFilter: query,
    gameVersion,
    pageSize: limit,
    index: offset,
  });

  return result.data.map((mod) => ({
    id: String(mod.id),
    slug: mod.slug,
    name: mod.name,
    description: mod.summary,
    downloads: mod.downloadCount,
    iconUrl: mod.logo?.thumbnailUrl,
    source: "curseforge" as const,
  }));
}

export async function getModDetail(
  projectId: string,
  source: "modrinth" | "curseforge"
) {
  if (source === "modrinth") {
    const project = await modrinth.getProject(projectId);
    return {
      id: project.id,
      slug: project.slug,
      name: project.title,
      description: project.description,
      body: project.body,
      downloads: project.downloads,
      iconUrl: project.icon_url,
      categories: project.categories,
      versions: project.versions,
      source: "modrinth" as const,
    };
  }

  const mod = await curseforge.getMod(Number(projectId));
  return {
    id: String(mod.id),
    slug: mod.slug,
    name: mod.name,
    description: mod.summary,
    body: mod.summary,
    downloads: mod.downloadCount,
    iconUrl: mod.logo?.thumbnailUrl,
    source: "curseforge" as const,
  };
}

export async function getModVersions(
  projectId: string,
  gameVersion?: string,
  loader?: string,
  source: "modrinth" | "curseforge" = "modrinth"
): Promise<ModVersionResult[]> {
  if (source === "modrinth") {
    const versions = await modrinth.getProjectVersions(projectId, {
      loaders: loader ? [loader] : undefined,
      gameVersions: gameVersion ? [gameVersion] : undefined,
    });

    return versions.map((v: ProjectVersion) => ({
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

  const versions = await curseforge.getModFiles({
    modId: Number(projectId),
    gameVersion,
  });

  return versions.data.map((v) => ({
    id: String(v.id),
    name: v.displayName,
    versionNumber: v.fileName,
    gameVersions: v.gameVersions,
    loaders: [],
    files: [
      {
        filename: v.fileName,
        url: v.downloadUrl || "",
        size: v.fileLength,
        primary: true,
      },
    ],
  }));
}

export async function installMod(
  requestId: string,
  projectId: string,
  versionId: string | undefined,
  gamePath: string,
  source: "modrinth" | "curseforge"
) {
  if (source === "modrinth") {
    const versions = await modrinth.getProjectVersions(projectId);
    const version = versionId
      ? versions.find((v: ProjectVersion) => v.id === versionId)
      : versions[0];

    if (!version) {
      throw new Error("No version found");
    }

    const primaryFile = version.files.find((f) => f.primary) || version.files[0];

    if (!primaryFile) {
      throw new Error("No file found in version");
    }

    // Download the mod file
    const modsDir = `${gamePath}/mods`;
    const { ensureDir } = await import("../utils/paths.js");
    ensureDir(modsDir);

    const response = await fetch(primaryFile.url);
    if (!response.ok) {
      throw new Error(`Failed to download mod: ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const { writeFileSync } = await import("fs");
    const { join } = await import("path");
    const filePath = join(modsDir, primaryFile.filename);
    writeFileSync(filePath, buffer);

    sendProgress(requestId, {
      stage: "mod-installed",
      current: 1,
      total: 1,
      message: primaryFile.filename,
    });

    return {
      projectId,
      versionId: version.id,
      filename: primaryFile.filename,
      path: filePath,
    };
  }

  throw new Error("CurseForge mod install not yet implemented");
}
