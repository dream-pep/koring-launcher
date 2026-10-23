import * as fs from 'fs';
import * as path from 'path';

/**
 * 版本目录扫描 / 版本 JSON 解析的纯逻辑模块。
 *
 * 约束：本文件不得 import electron 或任何 @xmcl/*（保持可在纯 node 下被脚本直接验证）。
 * instance.ts 与 game-folder.ts / launch-target.ts 共用这里的实现，避免重复。
 */

/** 版本 JSON 中单条 library 的描述子集 */
export interface VersionLibrary {
  name?: string;
  rules?: { action?: string; os?: { name?: string; arch?: string } }[];
  downloads?: {
    artifact?: { path?: string; url?: string };
    classifiers?: Record<string, { path?: string; url?: string }>;
  };
}

/** 版本 JSON 的最小可用子集 */
export interface VersionJsonLite {
  id?: string;
  type?: string;
  releaseTime?: string;
  inheritsFrom?: string;
  /** 客户端 JAR 所属的版本 id（继承版本里通常指向父版本） */
  jar?: string;
  mainClass?: string;
  assets?: string;
  assetIndex?: { id?: string };
  downloads?: { client?: { url?: string; sha1?: string; size?: number } };
  libraries?: VersionLibrary[];
}

export type LoaderKey = 'forge' | 'neoForged' | 'fabricLoader' | 'quiltLoader' | 'optifine';

export const LOADER_LABELS: Record<LoaderKey, string> = {
  forge: 'Forge',
  neoForged: 'NeoForge',
  fabricLoader: 'Fabric',
  quiltLoader: 'Quilt',
  optifine: 'OptiFine',
};

// 加载器版本提取规则（取自 libraries[].name 的 Maven 坐标）
const LOADER_PATTERNS: [LoaderKey, RegExp][] = [
  ['forge', /^net\.minecraftforge:forge:([\d.]+(?:-\d+(?:\.\d+)*)?)/],
  ['neoForged', /^net\.neoforged:neoforge:([\d.]+)/],
  ['fabricLoader', /^net\.fabricmc:fabric-loader:([\d.]+)/],
  ['quiltLoader', /^org\.quiltmc:quilt-loader:([\d.]+)/],
  ['optifine', /^optifine:OptiFine:([\w.]+)/],
];

export function readVersionJson<T = VersionJsonLite>(file: string): T | null {
  try {
    const raw = fs.readFileSync(file, 'utf-8');
    const json = JSON.parse(raw);
    if (!json || typeof json !== 'object') return null;
    return json as T;
  } catch {
    return null;
  }
}

/** 从版本 JSON 检测 mod 加载器（用于 UI 徽章） */
export function detectLoadersFromJson(json: VersionJsonLite | null): string[] {
  if (!json) return [];
  const loaders: string[] = [];
  for (const lib of json.libraries || []) {
    const name = lib.name || '';
    if (name.startsWith('net.minecraftforge:forge:') || name.startsWith('net.neoforged:')) {
      if (!loaders.includes('forge')) loaders.push('forge');
    } else if (name.startsWith('net.fabricmc:yarn:') || name.startsWith('net.fabricmc:fabric-loader:')) {
      if (!loaders.includes('fabric')) loaders.push('fabric');
    } else if (name.startsWith('org.quiltmc:quilt-loader:')) {
      if (!loaders.includes('quilt')) loaders.push('quilt');
    } else if (name.startsWith('optifine:OptiFine:')) {
      if (!loaders.includes('optifine')) loaders.push('optifine');
    }
  }
  return loaders;
}

/** 从版本 JSON 提取加载器及其版本（用于启动版本解析 / 导入实例） */
export function detectLoaderVersionsFromJson(json: VersionJsonLite | null): Partial<Record<LoaderKey, string>> {
  const found: Partial<Record<LoaderKey, string>> = {};
  if (!json) return found;
  for (const lib of json.libraries || []) {
    const name = lib.name || '';
    for (const [key, pattern] of LOADER_PATTERNS) {
      if (found[key]) continue;
      const match = name.match(pattern);
      if (match) {
        found[key] = match[1];
        break;
      }
    }
  }
  return found;
}

export function detectLoaders(jsonPath: string): string[] {
  return detectLoadersFromJson(readVersionJson(jsonPath));
}

export interface VersionChain {
  /** 从自身到最底层父版本的 id 链 */
  chain: string[];
  /** 链根（最底层父版本，通常是原版 id） */
  rootId: string;
  /** 链上所有版本 JSON 合并后的加载器版本 */
  loaders: Partial<Record<LoaderKey, string>>;
  /** 第一条（最靠近自身）出现的 assets index */
  assetIndex?: string;
  /** 解析过程中的问题（不致命） */
  warnings: string[];
}

/**
 * 解析版本目录的 inheritsFrom 继承链。
 * 环 / 过深 / JSON 缺失 / 目录名与 json.id 不一致都会记入 warnings，而不是抛异常。
 */
export function readVersionChain(versionsDir: string, id: string, maxDepth = 10): VersionChain {
  const chain: string[] = [];
  const loaders: Partial<Record<LoaderKey, string>> = {};
  const warnings: string[] = [];
  let assetIndex: string | undefined;
  let current: string | undefined = id;
  const visited = new Set<string>();

  while (current && chain.length < maxDepth) {
    if (visited.has(current)) {
      warnings.push(`版本继承链存在循环：${[...visited, current].join(' → ')}`);
      break;
    }
    visited.add(current);
    chain.push(current);

    const jsonPath = path.join(versionsDir, current, `${current}.json`);
    const json = readVersionJson(jsonPath);
    if (!json) {
      warnings.push(`版本 JSON 缺失或无法解析：${current}`);
      break;
    }
    if (json.id && json.id !== current) {
      warnings.push(`版本 JSON 的 id（${json.id}）与目录名（${current}）不一致`);
    }
    const libLoaders = detectLoaderVersionsFromJson(json);
    for (const key of Object.keys(libLoaders) as LoaderKey[]) {
      if (!loaders[key]) loaders[key] = libLoaders[key];
    }
    if (!assetIndex) {
      assetIndex = json.assetIndex?.id || json.assets;
    }
    current = json.inheritsFrom;
    if (current && chain.length >= maxDepth) {
      warnings.push(`版本继承链超过 ${maxDepth} 层，已截断`);
    }
  }

  return { chain, rootId: chain[chain.length - 1] || id, loaders, assetIndex, warnings };
}

/** 扫描目录中已安装版本的信息 */
export interface ScannedVersion {
  id: string;
  type: string;
  releaseTime?: string;
  /** JAR 文件是否存在 */
  hasJar: boolean;
  /** JSON 文件是否存在 */
  hasJson: boolean;
  /** 检测到的 mod 加载器 */
  loaders: string[];
  /** 是否健康（JSON + JAR 都存在） */
  healthy: boolean;
}

/** 扫描指定目录，返回 versions 子目录中所有已安装版本的详细信息 */
export function scanGameDirectories(gamePath: string, limit = 500): ScannedVersion[] {
  const versionsPath = path.join(gamePath, 'versions');
  if (!fs.existsSync(versionsPath)) return [];
  try {
    return fs
      .readdirSync(versionsPath, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .slice(0, limit)
      .map((e) => {
        const id = e.name;
        const versionDir = path.join(versionsPath, id);
        const jsonPath = path.join(versionDir, `${id}.json`);
        const jarPath = path.join(versionDir, `${id}.jar`);
        const hasJson = fs.existsSync(jsonPath);
        const hasJar = fs.existsSync(jarPath);

        let type = 'unknown';
        let releaseTime: string | undefined;

        if (hasJson) {
          const json = readVersionJson(jsonPath);
          if (json) {
            type = json.type || 'unknown';
            releaseTime = json.releaseTime;
          }
        }

        const loaders = hasJson ? detectLoaders(jsonPath) : [];
        const healthy = hasJson && hasJar;

        return { id, type, releaseTime, hasJar, hasJson, loaders, healthy };
      });
  } catch {
    return [];
  }
}
