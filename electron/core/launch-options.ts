//  __         __     __   __     ______     __  __     ______        __   __     ______     ______
// /\ \       /\ \   /\ "-.\ \   /\  ___\   /\ \/ /    /\  ___\      /\ "-.\ \   /\  ___\   /\__  _\
// \ \ \____  \ \ \  \ \ \-.  \  \ \ \__ \  \ \  _"-.  \ \  __\      \ \ \-.  \  \ \  __\   \/_/\ \/
//  \ \_____\  \ \_\  \ \_\\"\_\  \ \_____\  \ \_\ \_\  \ \_____\     \ \_\\"\_\  \ \_____\    \ \_\
//   \/_____/   \/_/   \/_/ \/_/   \/_____/   \/_/\/_/   \/_____/      \/_/ \/_/   \/_____/     \/_/
//
// 所有权利归Lingke Network (china)所有 | dream_pep拥有其艺术改变权力
// 未经允许的情况下删除此版权头可能会受到民事指控
// 请勿在未经Lingke Network (china)允许的范围内修改代码并分发

import type { LaunchOption } from '@xmcl/core';
import { resolveJava, getPotentialJavaLocations } from '@xmcl/installer';
import type { AppConfig } from '../config';
import type { InstanceInfo } from './instance';
import type { LaunchPlan } from './launch-target';

/** 游戏启动所需的账户档案 */
export interface LaunchProfile {
  username: string;
  uuid: string;
  accessToken?: string;
}

/** 快速联机目标服务器 */
export interface LaunchServer {
  ip: string;
  port?: number;
}

/**
 * 引号感知的命令行参数切分器。
 * 支持双引号 / 单引号包裹的含空格参数与反斜杠转义。
 * 用于 jvmArgs / gameArgs / preLaunchCmd 的解析。
 */
export function parseArgs(line: string): string[] {
  const args: string[] = [];
  const re = /"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'|(\S+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(line)) !== null) {
    if (match[1] !== undefined) {
      args.push(match[1].replace(/\\(["\\])/g, '$1'));
    } else if (match[2] !== undefined) {
      args.push(match[2].replace(/\\(['\\])/g, '$1'));
    } else {
      args.push(match[3]);
    }
  }
  return args;
}

/**
 * 将启动器配置（AppConfig.java / AppConfig.advanced）+ 实例信息 + 账户档案
 * 映射为 @xmcl/core 的 LaunchOption。
 *
 * 配置 → 启动参数 对应关系：
 * - java.memMode=auto   → 实例 minMemory/maxMemory（未设置则 1024/4096）
 * - java.memMode=custom → min=min(2,memGB)G，max=memGB G
 * - java.gc=zgc/g1      → -XX:+UseZGC / -XX:+UseG1GC
 * - java.jvmArgs        → 逐行解析并入 extraJVMArgs
 * - advanced.gameArgs   → 解析并入 extraMCArgs
 * - advanced.winMode    → resolution（fullscreen / custom 宽高）
 * - advanced.preLaunchCmd → prependCommand（Windows 批处理需 `cmd /c` 前缀）
 * - advanced.debugMode  → -Dkoring.debugMode=true
 */
export function buildLaunchOptions(
  config: AppConfig,
  instance: InstanceInfo,
  profile: LaunchProfile,
  javaPath: string,
  server?: LaunchServer,
  plan?: LaunchPlan,
): LaunchOption {
  const java = config.java;
  const adv = config.advanced;

  // ---- 内存 ----
  let minMemory = instance.config.minMemory ?? 1024;
  let maxMemory = instance.config.maxMemory ?? 4096;
  if (java.memMode === 'custom') {
    const gb = Math.max(1, Math.min(16, java.memGB || 4));
    minMemory = Math.min(2, gb) * 1024;
    maxMemory = gb * 1024;
    // 初始内存 -Xms：0 = 不主动设置（沿用上面的最小内存）
    if ((java.initialMemGB ?? 0) > 0) {
      minMemory = Math.min(java.initialMemGB, gb) * 1024;
    }
  }
  // 锁定内存：-Xms 跟随 -Xmx，固定堆大小（PCL 同名开关）
  if (java.lockMemory) {
    minMemory = maxMemory;
  }

  // ---- JVM 参数 ----
  const extraJVMArgs: string[] = [];
  if (java.gc === 'zgc') extraJVMArgs.push('-XX:+UseZGC');
  else if (java.gc === 'g1') extraJVMArgs.push('-XX:+UseG1GC');
  if (java.preferredIpStack === 'ipv4') {
    extraJVMArgs.push('-Djava.net.preferIPv4Stack=true');
  } else if (java.preferredIpStack === 'ipv6') {
    extraJVMArgs.push('-Djava.net.preferIPv6Stack=true');
  }
  if (java.jvmArgs?.trim()) {
    extraJVMArgs.push(...parseArgs(java.jvmArgs));
  }
  if (adv.debugMode) {
    extraJVMArgs.push('-Dkoring.debugMode=true');
  }

  // ---- 游戏参数 ----
  const extraMCArgs: string[] = [];
  if (adv.gameArgs?.trim()) {
    extraMCArgs.push(...parseArgs(adv.gameArgs));
  }

  // ---- 窗口 / 分辨率 ----
  let resolution: { width?: number; height?: number; fullscreen?: boolean } | undefined;
  if (adv.winMode === 'fullscreen') {
    resolution = { fullscreen: true };
  } else if (adv.winMode === 'custom') {
    resolution = { width: adv.customWidth || 854, height: adv.customHeight || 480 };
  }

  return {
    gameProfile: { name: profile.username, id: profile.uuid },
    accessToken: profile.accessToken,
    javaPath,
    // version 由调用方在 Version.parse 后覆盖为 ResolvedVersion
    version: plan?.resolved.id ?? instance.config.runtime.minecraft,
    // gamePath 决定 --gameDir（saves/mods/logs），resourcePath 决定 versions/libraries/assets
    gamePath: plan?.roots.gameRoot ?? instance.path,
    resourcePath: plan?.roots.resourceRoot ?? instance.path,
    minMemory,
    maxMemory,
    resolution,
    extraJVMArgs,
    extraMCArgs,
    server,
    prependCommand: adv.preLaunchCmd?.trim() ? parseArgs(adv.preLaunchCmd) : undefined,
    launcherName: 'Koring Launcher',
    launcherBrand: 'Koring',
  };
}

/** 该 Minecraft 版本要求的 Java 主版本（1.20.5+ / 1.21+ → 21，1.18–1.20.4 → 17，1.16.5- → 8） */
export function requiredJavaMajor(minecraftVersion: string): number {
  const parts = minecraftVersion.split('.').map((part) => Number.parseInt(part, 10));
  const [major, minor, patch] = parts;
  if (!Number.isFinite(major)) return 21; // 快照（24w45a 等）按最新版处理
  if (major > 1) return 21;
  if (!Number.isFinite(minor)) return 21;
  if (minor > 20) return 21;
  if (minor === 20) return (patch ?? 0) >= 5 ? 21 : 17;
  if (minor >= 17) return 17;
  return 8;
}

export interface JavaCandidate {
  path: string;
  version?: string;
  majorVersion?: number;
  vendor?: string;
}

/** 扫描本机所有可用的 Java（供设置页展示与自动匹配使用） */
export async function scanJavaInstallations(): Promise<JavaCandidate[]> {
  const candidates: JavaCandidate[] = [];
  try {
    const locations = await getPotentialJavaLocations();
    for (const location of locations) {
      const info = await resolveJava(location).catch(() => undefined);
      if (!info?.path) continue;
      if (candidates.some((entry) => entry.path === info.path)) continue;
      candidates.push({
        path: info.path,
        version: (info as { version?: string }).version,
        majorVersion: (info as { majorVersion?: number }).majorVersion,
        vendor: (info as { vendor?: string }).vendor,
      });
    }
  } catch {
    // 扫描失败返回空列表，调用方自行回退
  }
  return candidates;
}

/** 按 Minecraft 版本要求挑一个最合适的 Java：优先主版本完全一致，其次满足要求的最小版本 */
export async function pickJavaForVersion(minecraftVersion: string): Promise<string | undefined> {
  const required = requiredJavaMajor(minecraftVersion);
  const candidates = (await scanJavaInstallations()).filter((entry) => Number.isFinite(entry.majorVersion));
  if (!candidates.length) return undefined;

  const exact = candidates.filter((entry) => entry.majorVersion === required);
  if (exact.length) return exact[0].path;

  const compatible = candidates
    .filter((entry) => (entry.majorVersion ?? 0) > required)
    .sort((a, b) => (a.majorVersion ?? 0) - (b.majorVersion ?? 0));
  if (compatible.length) return compatible[0].path;

  return candidates.sort((a, b) => (b.majorVersion ?? 0) - (a.majorVersion ?? 0))[0].path;
}

/**
 * Java 自动匹配方案（供设置页展示「启动该版本会使用哪个 Java」）。
 */
export interface JavaPlan {
  /** 该 MC 版本要求的 Java 主版本 */
  requiredMajor: number;
  /** 自动匹配到的 Java 路径（本机没有可用 Java 时为 undefined） */
  pickedPath?: string;
  /** 本机扫描到的全部 Java */
  candidates: JavaCandidate[];
}

export async function planJavaForVersion(minecraftVersion: string): Promise<JavaPlan> {
  const candidates = await scanJavaInstallations();
  const pickedPath = await pickJavaForVersion(minecraftVersion);
  return { requiredMajor: requiredJavaMajor(minecraftVersion), pickedPath, candidates };
}

/**
 * 解析 Java 可执行文件路径，优先级：
 * 1. `autoJavaPath` 开启时，按 Minecraft 版本自动匹配本机 Java
 * 2. 用户配置路径（resolveJava 校验，无效则继续向下）
 * 3. 系统扫描（`where java` / `which java` 结果逐个 resolve）
 * 4. 兜底 PATH 中的 `java`
 */
export async function resolveJavaPath(
  configuredPath: string,
  options?: { auto?: boolean; minecraftVersion?: string; useJavaExe?: boolean }
): Promise<string> {
  // java.exe 偏好：把 javaw.exe 换成 java.exe（能看到控制台输出）
  const finalize = (resolved: string): string => {
    if (!options?.useJavaExe) return resolved;
    return resolved.replace(/javaw(\.exe)?$/i, 'java$1');
  };
  if (options?.auto && options.minecraftVersion) {
    const picked = await pickJavaForVersion(options.minecraftVersion);
    if (picked) return finalize(picked);
  }
  if (configuredPath?.trim()) {
    const info = await resolveJava(configuredPath.trim()).catch(() => undefined);
    if (info) return finalize(info.path);
  }
  try {
    const locations = await getPotentialJavaLocations();
    for (const loc of locations) {
      const info = await resolveJava(loc).catch(() => undefined);
      if (info) return finalize(info.path);
    }
  } catch {
    // 扫描失败则继续回退
  }
  return finalize('java');
}
