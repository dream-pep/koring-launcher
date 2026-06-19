import { sidecarRequest } from "./sidecar";

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
  limit?: number,
  offset?: number,
  source: "modrinth" | "curseforge" = "modrinth"
): Promise<ModSearchResult[]> {
  return sidecarRequest<ModSearchResult[]>("mods:search", {
    query,
    gameVersion,
    loader,
    limit,
    offset,
    source,
  });
}

export async function getModDetail(
  projectId: string,
  source: "modrinth" | "curseforge"
): Promise<ModSearchResult> {
  return sidecarRequest<ModSearchResult>("mods:detail", { projectId, source });
}

export async function getModVersions(
  projectId: string,
  gameVersion?: string,
  loader?: string,
  source: "modrinth" | "curseforge" = "modrinth"
): Promise<ModVersionResult[]> {
  return sidecarRequest<ModVersionResult[]>("mods:versions", {
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
  source: "modrinth" | "curseforge" = "modrinth"
): Promise<{ projectId: string; versionId: string; filename: string; path: string }> {
  return sidecarRequest("mods:install", {
    projectId,
    versionId,
    gamePath,
    source,
  });
}
