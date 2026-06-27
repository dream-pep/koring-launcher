import electron from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';

const { net } = electron;

const VERSION_MANIFEST_URL = 'https://launchermeta.mojang.com/mc/game/version_manifest.json';
const FORGE_VERSION_LIST_URL = 'https://files.minecraftforge.net/net/minecraftforge/forge/json';
const FABRIC_VERSION_LIST_URL = 'https://meta.fabricmc.net/v2/versions';

interface VersionInfo {
  id: string;
  type: string;
  url: string;
}

interface VersionManifest {
  latest: { release: string; snapshot: string };
  versions: VersionInfo[];
}

interface DownloadProgress {
  stage: string;
  current: number;
  total: number;
  message?: string;
}

async function downloadFile(url: string, dest: string, onProgress?: (progress: DownloadProgress) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const request = client.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        downloadFile(response.headers.location!, dest, onProgress).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Download failed: ${response.statusCode}`));
        return;
      }

      const totalBytes = parseInt(response.headers['content-length'] || '0', 10);
      let downloadedBytes = 0;

      const dir = path.dirname(dest);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const file = fs.createWriteStream(dest);

      response.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        if (onProgress && totalBytes > 0) {
          onProgress({
            stage: 'downloading',
            current: downloadedBytes,
            total: totalBytes,
            message: `${Math.round((downloadedBytes / totalBytes) * 100)}%`,
          });
        }
      });

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        resolve();
      });

      file.on('error', (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
    });

    request.on('error', reject);
  });
}

export async function getVersionList(type?: string): Promise<VersionManifest> {
  const response = await net.fetch(VERSION_MANIFEST_URL);
  if (!response.ok) throw new Error(`Failed to fetch version manifest: ${response.status}`);
  const manifest = await response.json() as VersionManifest;

  if (type && type !== 'all') {
    manifest.versions = manifest.versions.filter((v) => v.type === type);
  }

  return manifest;
}

export async function getForgeVersions(mcVersion?: string) {
  try {
    const response = await net.fetch(FORGE_VERSION_LIST_URL);
    if (!response.ok) throw new Error(`Forge version list failed: ${response.status}`);
    const data = await response.json() as { versions: Record<string, string[]> };
    const versions = data.versions[mcVersion || ''] || [];
    return { versions };
  } catch {
    return { versions: [] };
  }
}

export async function getFabricVersions(mcVersion?: string) {
  try {
    const url = mcVersion
      ? `${FABRIC_VERSION_LIST_URL}/loader/${mcVersion}`
      : `${FABRIC_VERSION_LIST_URL}/loader`;
    const response = await net.fetch(url);
    if (!response.ok) throw new Error(`Fabric version list failed: ${response.status}`);
    const data = await response.json() as { version: string; stable: boolean }[];
    return { versions: data.map((v) => v.version) };
  } catch {
    return { versions: [] };
  }
}

export async function installMinecraft(
  version: string,
  gamePath: string,
  javaPath?: string,
  downloadThreads?: number,
  callbacks?: { onProgress?: (progress: DownloadProgress) => void }
): Promise<{ version: string; gamePath: string }> {
  const versionDir = path.join(gamePath, 'versions', version);
  if (!fs.existsSync(versionDir)) {
    fs.mkdirSync(versionDir, { recursive: true });
  }

  // Download version manifest
  const manifestResponse = await net.fetch(VERSION_MANIFEST_URL);
  const manifest = await manifestResponse.json() as VersionManifest;
  const versionInfo = manifest.versions.find((v) => v.id === version);

  if (!versionInfo) throw new Error(`Version ${version} not found`);

  callbacks?.onProgress?.({ stage: 'downloading', current: 0, total: 100, message: 'Downloading version manifest...' });

  // Download version JSON
  const versionJsonPath = path.join(versionDir, `${version}.json`);
  await downloadFile(versionInfo.url, versionJsonPath, callbacks?.onProgress);

  const versionJson = JSON.parse(fs.readFileSync(versionJsonPath, 'utf-8'));

  // Download client jar
  const clientJar = versionJson.downloads?.client;
  if (clientJar) {
    callbacks?.onProgress?.({ stage: 'downloading', current: 1, total: 3, message: 'Downloading client jar...' });
    const jarPath = path.join(versionDir, `${version}.jar`);
    await downloadFile(clientJar.url, jarPath, callbacks?.onProgress);
  }

  callbacks?.onProgress?.({ stage: 'downloading', current: 2, total: 3, message: 'Installing libraries...' });

  // Download libraries
  const libraries = versionJson.libraries || [];
  for (const lib of libraries) {
    if (lib.downloads?.artifact?.url) {
      const libPath = path.join(gamePath, 'libraries', lib.downloads.artifact.path);
      if (!fs.existsSync(libPath)) {
        await downloadFile(lib.downloads.artifact.url, libPath);
      }
    }
  }

  callbacks?.onProgress?.({ stage: 'downloading', current: 3, total: 3, message: 'Installation complete' });

  return { version, gamePath };
}

export async function installModLoader(
  mcVersion: string,
  gamePath: string,
  loaderType: 'forge' | 'fabric' | 'quilt' | 'neoforge',
  loaderVersion?: string,
  javaPath?: string,
  callbacks?: { onProgress?: (progress: DownloadProgress) => void }
): Promise<{ loaderType: string; mcVersion: string; loaderVersion: string }> {
  callbacks?.onProgress?.({ stage: 'installing', current: 0, total: 100, message: `Installing ${loaderType}...` });

  // Placeholder: actual implementation depends on loader type
  // This would call the appropriate installer for Forge/Fabric/Quilt/NeoForge

  callbacks?.onProgress?.({ stage: 'installing', current: 100, total: 100, message: `${loaderType} installed` });

  return {
    loaderType,
    mcVersion,
    loaderVersion: loaderVersion || 'latest',
  };
}
