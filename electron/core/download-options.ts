import type { Options } from '@xmcl/installer';

/**
 * 统一下载源与下载选项（纯逻辑，不 import electron）。
 *
 * 背景：仓库里 @xmcl/installer 的调用点（instance.ts / task.ts）此前一律硬编码 BMCLAPI，
 * 而设置页里的 `download.fileSource` / `download.threads` 没有任何消费者——属于「假设置」。
 * 这里把「下载源 + 并发」收敛成唯一入口，主进程所有安装 / 依赖补齐都必须经过它。
 */

export type DownloadSource = 'official' | 'bmclapi' | 'custom';

export interface DownloadSettings {
  /** 配置层存的是普通字符串，取值合法性由 resolveDownloadSource 兜底校验 */
  source?: DownloadSource | string;
  customVersionManifest?: string;
  customMavenHost?: string;
  customAssetsHost?: string;
  threads?: number;
}

// ==================== BMCLAPI 镜像源 ====================
export const BMCLAPI_VERSION_MANIFEST = 'https://bmclapi2.bangbang93.com/mc/game/version_manifest.json';
export const BMCLAPI_MAVEN = 'https://bmclapi2.bangbang93.com/maven';
export const BMCLAPI_ASSETS = 'https://bmclapi2.bangbang93.com/assets';

// BMCLAPI 域名替换规则（按顺序匹配，带路径前缀的规则优先）
// 版本 JSON/客户端：launchermeta|launcher|piston-meta|piston-data.mojang.com → bmclapi2.bangbang93.com
// Assets：resources.download.minecraft.net → bmclapi2.bangbang93.com/assets
// Libraries：libraries.minecraft.net → bmclapi2.bangbang93.com/maven
// Forge：files.minecraftforge.net/maven → bmclapi2.bangbang93.com/maven
// NeoForge：maven.neoforged.net/releases → bmclapi2.bangbang93.com/maven
// Fabric：meta.fabricmc.net → bmclapi2.bangbang93.com/fabric-meta；maven.fabricmc.net → bmclapi2.bangbang93.com/maven
export const MIRROR_RULES: [string, string][] = [
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

/** 将官方资源 URL 改写为 BMCLAPI 镜像 URL（未命中的 URL 原样返回） */
export function rewriteToMirror(url: string): string {
  try {
    const u = new URL(url);
    for (const [from, to] of MIRROR_RULES) {
      const slashIdx = from.indexOf('/');
      const fromHost = slashIdx === -1 ? from : from.slice(0, slashIdx);
      const fromPath = slashIdx === -1 ? '' : from.slice(slashIdx);
      if (u.host !== fromHost) continue;
      if (fromPath && !u.pathname.startsWith(fromPath)) continue;
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

export interface ResolvedDownloadSource {
  kind: DownloadSource;
  /** 版本清单（version_manifest.json）地址 */
  versionManifest?: string;
  mavenHost?: string;
  assetsHost?: string;
  label: string;
  /** 是否需要对第三方元数据请求做主机改写 */
  rewriteRequests: boolean;
}

export const DOWNLOAD_SOURCE_LABELS: Record<DownloadSource, string> = {
  official: '官方源',
  bmclapi: 'BMCLAPI 镜像',
  custom: '自定义源',
};

function isValidSource(value: unknown): value is DownloadSource {
  return value === 'official' || value === 'bmclapi' || value === 'custom';
}

export function resolveDownloadSource(settings?: DownloadSettings): ResolvedDownloadSource {
  const kind: DownloadSource = isValidSource(settings?.source) ? settings!.source! : 'bmclapi';

  if (kind === 'official') {
    return { kind, label: DOWNLOAD_SOURCE_LABELS.official, rewriteRequests: false };
  }

  if (kind === 'custom') {
    return {
      kind,
      label: DOWNLOAD_SOURCE_LABELS.custom,
      versionManifest: settings?.customVersionManifest?.trim() || undefined,
      mavenHost: settings?.customMavenHost?.trim() || undefined,
      assetsHost: settings?.customAssetsHost?.trim() || undefined,
      rewriteRequests: false,
    };
  }

  return {
    kind: 'bmclapi',
    label: DOWNLOAD_SOURCE_LABELS.bmclapi,
    versionManifest: BMCLAPI_VERSION_MANIFEST,
    mavenHost: BMCLAPI_MAVEN,
    assetsHost: BMCLAPI_ASSETS,
    rewriteRequests: true,
  };
}

/** BMCLAPI 源下把所有元数据请求改写为主机镜像；其他源返回 undefined（走原始地址） */
export function createMirrorFetch(source: ResolvedDownloadSource): typeof fetch | undefined {
  if (!source.rewriteRequests) return undefined;
  return (input: RequestInfo | URL, init?: RequestInit) => fetch(rewriteToMirror(String(input)), init);
}

export function sanitizeThreads(value: unknown, fallback = 8): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(64, Math.max(1, Math.floor(parsed)));
}

/** @xmcl/installer 的完整下载选项：所有安装 / 依赖补齐统一走这里 */
export function buildInstallOptions(settings?: DownloadSettings): Options {
  const source = resolveDownloadSource(settings);
  const concurrency = sanitizeThreads(settings?.threads);
  const options: Options = {
    librariesDownloadConcurrency: concurrency,
    assetsDownloadConcurrency: concurrency,
  };
  if (source.mavenHost) options.mavenHost = source.mavenHost;
  if (source.assetsHost) options.assetsHost = source.assetsHost;
  const mirrorFetch = createMirrorFetch(source);
  if (mirrorFetch) options.fetch = mirrorFetch;
  return options;
}

/** 版本清单等「列表类」请求的来源 */
export function versionListRequest(settings?: DownloadSettings): { remote: string; fetch?: typeof fetch } {
  const source = resolveDownloadSource(settings);
  const request: { remote: string; fetch?: typeof fetch } = {
    remote: source.versionManifest || 'https://launchermeta.mojang.com/mc/game/version_manifest_v2.json',
  };
  const mirrorFetch = createMirrorFetch(source);
  if (mirrorFetch) request.fetch = mirrorFetch;
  return request;
}
