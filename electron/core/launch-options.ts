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
  }

  // ---- JVM 参数 ----
  const extraJVMArgs: string[] = [];
  if (java.gc === 'zgc') extraJVMArgs.push('-XX:+UseZGC');
  else if (java.gc === 'g1') extraJVMArgs.push('-XX:+UseG1GC');
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
    version: instance.config.runtime.minecraft,
    gamePath: instance.path,
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

/**
 * 解析 Java 可执行文件路径，优先级：
 * 1. 用户配置路径（resolveJava 校验，无效则继续向下）
 * 2. 系统扫描（`where java` / `which java` 结果逐个 resolve）
 * 3. 兜底 PATH 中的 `java`
 */
export async function resolveJavaPath(configuredPath: string): Promise<string> {
  if (configuredPath?.trim()) {
    const info = await resolveJava(configuredPath.trim()).catch(() => undefined);
    if (info) return info.path;
  }
  try {
    const locations = await getPotentialJavaLocations();
    for (const loc of locations) {
      const info = await resolveJava(loc).catch(() => undefined);
      if (info) return info.path;
    }
  } catch {
    // 扫描失败则继续回退
  }
  return 'java';
}
