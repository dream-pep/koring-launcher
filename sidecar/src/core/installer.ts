import {
  getVersionList,
  install,
  installForge,
  installFabric,
  installDependencies,
  getForgeVersionList,
  getFabricLoaders,
  getQuiltLoaders,
  installQuiltVersion,
} from "@xmcl/installer";
import { sendProgress } from "../protocol/transport.js";

function progressCallback(requestId: string) {
  return (total: number, cur: number, message?: string) => {
    sendProgress(requestId, {
      stage: message || "downloading",
      current: cur,
      total,
    });
  };
}

export async function getVersionListAsync(type: string = "all") {
  const manifest = await getVersionList();
  if (type === "all") return manifest;
  const filtered = manifest.versions.filter((v) => v.type === type);
  return { latest: manifest.latest, versions: filtered };
}

export async function installMinecraft(
  requestId: string,
  version: string,
  gamePath: string,
  javaPath?: string,
  _downloadThreads?: number
) {
  await install({ id: version, url: "" }, gamePath, {
    java: javaPath,
    progress: progressCallback(requestId),
  } as any);

  return { version, gamePath };
}

export async function installForgeLoader(
  requestId: string,
  mcVersion: string,
  gamePath: string,
  javaPath?: string,
  forgeVersion?: string
) {
  const version = forgeVersion || mcVersion;

  await installForge({
    mcversion: mcVersion,
    version: version,
  }, gamePath, {
    java: javaPath,
    progress: progressCallback(requestId),
  } as any);

  return { loaderType: "forge", mcVersion, forgeVersion: version };
}

export async function installFabricLoader(
  requestId: string,
  mcVersion: string,
  gamePath: string,
  loaderVersion?: string
) {
  const loaders = await getFabricLoaders();
  const targetLoader = loaderVersion
    ? loaders.find((l) => l.version === loaderVersion)
    : loaders[loaders.length - 1];

  if (!targetLoader) {
    throw new Error(`Fabric loader not found: ${loaderVersion}`);
  }

  await installFabric({
    mcVersion,
    loaderVersion: targetLoader.version,
    gamePath,
    progress: progressCallback(requestId),
  } as any);

  return { loaderType: "fabric", mcVersion, loaderVersion: targetLoader.version };
}

export async function installQuiltLoader(
  requestId: string,
  mcVersion: string,
  gamePath: string,
  loaderVersion?: string
) {
  const loaders = await getQuiltLoaders();
  const targetLoader = loaderVersion
    ? loaders.find((l) => l.version === loaderVersion)
    : loaders[loaders.length - 1];

  if (!targetLoader) {
    throw new Error(`Quilt loader not found: ${loaderVersion}`);
  }

  await installQuiltVersion({
    minecraftVersion: mcVersion,
    version: targetLoader.version,
    minecraft: gamePath,
  });

  return { loaderType: "quilt", mcVersion, loaderVersion: targetLoader.version };
}

export async function getForgeVersions(mcVersion?: string) {
  const list = await getForgeVersionList();
  if (mcVersion) {
    const versions = list.versions.filter((v) => v.mcversion === mcVersion);
    return { mcVersion, versions };
  }
  return list;
}

export async function getFabricVersions(mcVersion?: string) {
  const loaders = await getFabricLoaders();
  if (mcVersion) {
    return { mcVersion, loaders };
  }
  return { loaders };
}

export async function ensureDependencies(
  requestId: string,
  gamePath: string,
  versionId: string
) {
  const { Version } = await import("@xmcl/core");
  const resolved = await Version.parse(gamePath, versionId);
  await installDependencies(resolved, {
    progress: progressCallback(requestId),
  } as any);
  return { version: versionId };
}
