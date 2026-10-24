//  __         __     __   __     ______     __  __     ______        __   __     ______     ______
// /\ \       /\ \   /\ "-.\ \   /\  ___\   /\ \/ /    /\  ___\      /\ "-.\ \   /\  ___\   /\__  _\
// \ \ \____  \ \ \  \ \ \-.  \  \ \ \__ \  \ \  _"-.  \ \  __\      \ \ \-.  \  \ \  __\   \/_/\ \/
//  \ \_____\  \ \_\  \ \_\\"\_\  \ \_____\  \ \_\ \_\  \ \_____\     \ \_\\"\_\  \ \_____\    \ \_\
//   \/_____/   \/_/   \/_/ \/_/   \/_____/   \/_/\/_/   \/_____/      \/_/ \/_/   \/_____/     \/_/
//
// 所有权利归Lingke Network (china)所有 | dream_pep拥有其艺术改变权力
// 未经允许的情况下删除此版权头可能会受到民事指控
// 请勿在未经Lingke Network (china)允许的范围内修改代码并分发

import * as path from 'path';
import { Version, launch, createMinecraftProcessWatcher } from '@xmcl/core';
import type { AppConfig } from '../config';
import { getInstanceInfo, planInstanceLaunch, updateInstance } from './instance';
import { checkDependencies, describeDependencyReport } from './launch-target';
import {
  buildLaunchOptions,
  resolveJavaPath,
  type LaunchProfile,
  type LaunchServer,
} from './launch-options';

export interface GameLaunchResult {
  pid: number;
  version: string;
  username: string;
}

export interface LaunchEvent {
  event: string;
  [key: string]: unknown;
}

export interface LaunchGameOptions {
  /** 主进程权威配置（内存中最新值） */
  config: AppConfig;
  /** 实例名 */
  instanceName: string;
  /** 实例父目录（游戏根目录） */
  gamePath: string;
  /** 账户档案 */
  profile: LaunchProfile;
  /** 快速联机目标服务器 */
  server?: LaunchServer;
  /** 事件回调（stdout / stderr / window-ready / exit） */
  onEvent?: (event: LaunchEvent) => void;
}

/**
 * 统一游戏启动入口：
 * 实例信息 → 版本解析 → Java 解析 → 配置映射（buildLaunchOptions）→ @xmcl/core launch
 * 启动后监听 window-ready / exit，并在退出时累计实例 playtime。
 */
export async function launchGame(options: LaunchGameOptions): Promise<GameLaunchResult> {
  const { config, instanceName, gamePath, profile, server, onEvent } = options;

  // 1. 计算启动方案：资源根（versions/libraries/assets）、可启动版本 id、依赖体检
  const { instance, plan } = planInstanceLaunch(instanceName, gamePath);
  for (const warning of plan.issues) {
    onEvent?.({ event: 'warning', message: warning });
  }

  // 2. 解析版本（resourceRoot 决定 versions/libraries/assets，不是实例目录）
  const resolved = await Version.parse(plan.roots.resourceRoot, plan.resolved.id);

  // 3. 解析 Java 路径（按 MC 版本自动匹配 → 配置路径 → 系统扫描 → PATH）
  const javaPath = await resolveJavaPath(config.java.javaPath, {
    auto: config.java.autoJavaPath !== false,
    minecraftVersion: instance.config.runtime.minecraft,
    useJavaExe: config.java.useJavaExe === true,
  });

  // 4. 配置 → LaunchOption（version 覆盖为已解析版本）
  const launchOption = buildLaunchOptions(config, instance, profile, javaPath, server, plan);
  launchOption.version = resolved;

  onEvent?.({
    event: 'plan',
    versionId: plan.resolved.id,
    versionVia: plan.resolved.via,
    resourceRoot: plan.roots.resourceRoot,
    gameRoot: plan.roots.gameRoot,
    javaPath,
  });

  // 5. 启动（detached：启动器关闭后游戏继续运行；pipe：转发 stdout/stderr）
  const mcProcess = await launch({
    ...launchOption,
    extraExecOption: { detached: true, stdio: 'pipe' },
  });

  // 6. 事件监听
  const watcher = createMinecraftProcessWatcher(mcProcess);
  watcher.on('minecraft-window-ready', () => {
    onEvent?.({ event: 'window-ready' });
  });
  watcher.on('minecraft-exit', ({ code }) => {
    onEvent?.({ event: 'exit', code });
  });

  mcProcess.stdout?.on('data', (chunk: Buffer) => {
    const message = chunk.toString();
    if (message.trim()) onEvent?.({ event: 'stdout', message });
  });
  mcProcess.stderr?.on('data', (chunk: Buffer) => {
    const message = chunk.toString();
    if (message.trim()) onEvent?.({ event: 'stderr', message });
  });

  // 7. playtime 累计（游戏进程退出时）
  const startTime = Date.now();
  mcProcess.on('exit', async () => {
    const elapsed = Date.now() - startTime;
    try {
      const info = await getInstanceInfo(instanceName, gamePath);
      await updateInstance(instanceName, gamePath, {
        lastPlayedDate: Date.now(),
        playtime: (info.config.playtime || 0) + elapsed,
      });
    } catch {
      // 忽略 playtime 更新失败
    }
  });

  // 8. 更新最近访问时间
  try {
    updateInstance(instanceName, gamePath, { lastAccessDate: Date.now() });
  } catch {
    // 忽略
  }

  return {
    pid: mcProcess.pid || 0,
    version: plan.resolved.id,
    username: profile.username,
  };
}

/**
 * 诊断指定游戏目录下某个版本的健康状态（版本 JSON / 客户端 JAR / libraries / assets）。
 * 供 launch:diagnose 使用。
 */
export async function diagnoseVersion(gamePath: string, version: string): Promise<Record<string, unknown>> {
  const report = checkDependencies(gamePath, version);
  const detail = describeDependencyReport(report);

  return {
    version,
    gamePath,
    versionsDir: path.join(gamePath, 'versions'),
    healthy: report.ready,
    issues: detail ? [detail] : [],
    dependency: report,
  };
}
