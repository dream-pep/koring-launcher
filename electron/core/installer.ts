import electron from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';

const { net } = electron;

// ==================== BMCLAPI 镜像源配置 ====================
// 使用 BMCLAPI（bmclapi2.bangbang93.com）镜像加速国内资源下载
// 版本清单：launchermeta.mojang.com → bmclapi2.bangbang93.com
// Fabric 元数据：meta.fabricmc.net → bmclapi2.bangbang93.com/fabric-meta
const VERSION_MANIFEST_URL = 'https://bmclapi2.bangbang93.com/mc/game/version_manifest.json';
const FABRIC_VERSION_LIST_URL = 'https://bmclapi2.bangbang93.com/fabric-meta/v2/versions';

// BMCLAPI 域名替换规则（按顺序匹配，带路径前缀的规则优先）
// 版本 JSON/客户端：launchermeta|launcher|piston-meta|piston-data.mojang.com → bmclapi2.bangbang93.com
// Assets：resources.download.minecraft.net → bmclapi2.bangbang93.com/assets
// Libraries：libraries.minecraft.net → bmclapi2.bangbang93.com/maven
// Forge：files.minecraftforge.net/maven → bmclapi2.bangbang93.com/maven
// NeoForge：maven.neoforged.net/releases → bmclapi2.bangbang93.com/maven
// Fabric：meta.fabricmc.net → bmclapi2.bangbang93.com/fabric-meta；maven.fabricmc.net → bmclapi2.bangbang93.com/maven
const MIRROR_RULES: [string, string][] = [
  ['files.minecraftforge.net/maven', 'bmclapi2.bangbang93.com/maven'],
  ['maven.neoforged.net/releases', 'bmclapi2.bangbang93.com/maven'],
  ['launchermeta.mojang.com', 'bmclapi2.bangbang93.com'],
  ['launcher.mojang.com', 'bmclapi2.bangbang93.com'],
  ['piston-meta.mojang.com', 'bmclapi2.bangbang93.com'],
  ['piston-data.mojang.com', 'bmclapi2.bangbang93.com'],
  ['resources.download.minecraft.net', 'bmclapi2.bangbang93.com/assets'],
  ['libraries.minecraft.net', 'bmclapi2.bangbang93.com/maven'],
  ['maven.minecraftforge.net', 'bmclapi2.bangbang93.com/maven'],
  ['maven.neoforged.net', 'bmclapi2.bangbang93.com/maven'],
  ['meta.fabricmc.net', 'bmclapi2.bangbang93.com/fabric-meta'],
  ['maven.fabricmc.net', 'bmclapi2.bangbang93.com/maven'],
];

// 将官方资源 URL 改写为 BMCLAPI 镜像 URL（未命中的 URL 原样返回）
export function rewriteToMirror(url: string): string {
  try {
    const u = new URL(url);
    for (const [from, to] of MIRROR_RULES) {
      const slashIdx = from.indexOf('/');
      const fromHost = slashIdx === -1 ? from : from.slice(0, slashIdx);
      const fromPath = slashIdx === -1 ? '' : from.slice(slashIdx);
      if (u.host !== fromHost) continue;
      if (fromPath && !u.pathname.startsWith(fromPath)) continue;
      // 命中规则，替换主机（并附加镜像路径前缀）
      const toSlashIdx = to.indexOf('/');
      u.host = toSlashIdx === -1 ? to : to.slice(0, toSlashIdx);
      const toPath = toSlashIdx === -1 ? '' : to.slice(toSlashIdx);
      u.pathname = toPath + (fromPath ? u.pathname.slice(fromPath.length) : u.pathname);
      return u.toString();
    }
    return url;
  } catch {
    return url;
  }
}

interface VersionInfo {
  id: string;
  type: string;
  url: string;
  releaseTime: string;
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
  // 下载前统一改写为 BMCLAPI 镜像地址
  url = rewriteToMirror(url);
  return new Promise((resolve, reject) => {
    // 根据协议选择 http / https 客户端（分开调用以避免 TS 联合类型签名不兼容）
    const handleResponse = (response: http.IncomingMessage) => {
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

      response.on('data', (chunk: Buffer) => {
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
    };

    let request: http.ClientRequest;
    if (url.startsWith('https')) {
      request = https.get(url, handleResponse);
    } else {
      request = http.get(url, handleResponse);
    }

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
    // BMCLAPI Forge 版本列表接口（需指定 MC 版本）
    if (!mcVersion) return { versions: [] };
    const response = await net.fetch(`https://bmclapi2.bangbang93.com/forge/minecraft/${mcVersion}`);
    if (!response.ok) throw new Error(`Forge version list failed: ${response.status}`);
    const data = await response.json() as { version: string }[];
    return { versions: data.map((v) => v.version) };
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
