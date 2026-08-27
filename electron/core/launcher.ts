//  __         __     __   __     ______     __  __     ______        __   __     ______     ______
// /\ \       /\ \   /\ "-.\ \   /\  ___\   /\ \/ /    /\  ___\      /\ "-.\ \   /\  ___\   /\__  _\
// \ \ \____  \ \ \  \ \ \-.  \  \ \ \__ \  \ \  _"-.  \ \  __\      \ \ \-.  \  \ \  __\   \/_/\ \/
//  \ \_____\  \ \_\  \ \_\\"\_\  \ \_____\  \ \_\ \_\  \ \_____\     \ \_\\"\_\  \ \_____\    \ \_\
//   \/_____/   \/_/   \/_/ \/_/   \/_____/   \/_/\/_/   \/_____/      \/_/ \/_/   \/_____/     \/_/
//
// 所有权利归Lingke Network (china)所有 | dream_pep拥有其艺术改变权力
// 未经允许的情况下删除此版权头可能会受到民事指控
// 请勿在未经Lingke Network (china)允许的范围内修改代码并分发

import * as fs from 'fs';
import * as path from 'path';
import { Version, launch, createMinecraftProcessWatcher } from '@xmcl/core';
import type { AppConfig } from '../config';
import { getInstanceInfo, updateInstance } from './instance';
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

  // 1. 读取实例信息并做健康检查
  const instance = await getInstanceInfo(instanceName, gamePath);
  if (!instance.healthy) {
    const detail = instance.issues.join('；') || '未知问题';
    throw new Error(`实例「${instanceName}」未安装完整：${detail}。请先在资源中心安装或重新安装该实例。`);
  }

  // 2. 解析版本
  const resolved = await Version.parse(instance.path, instance.config.runtime.minecraft);

  // 3. 解析 Java 路径（配置路径 → 系统扫描 → PATH）
  const javaPath = await resolveJavaPath(config.java.javaPath);

  // 4. 配置 → LaunchOption（version 覆盖为已解析版本）
  const launchOption = buildLaunchOptions(config, instance, profile, javaPath, server);
  launchOption.version = resolved;

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
  await updateInstance(instanceName, gamePath, { lastAccessDate: Date.now() }).catch(() => {});

  return {
    pid: mcProcess.pid || 0,
    version: instance.config.runtime.minecraft,
    username: profile.username,
  };
}

/**
 * 诊断指定游戏目录下某个版本的健康状态（JSON + JAR 是否存在）。
 * 供 launch:diagnose 使用。
 */
export async function diagnoseVersion(gamePath: string, version: string): Promise<Record<string, unknown>> {
  const issues: string[] = [];
  const versionDir = path.join(gamePath, 'versions', version);
  const versionJsonPath = path.join(versionDir, `${version}.json`);
  const jarPath = path.join(versionDir, `${version}.jar`);

  if (!fs.existsSync(versionJsonPath)) {
    issues.push(`Version JSON not found: ${versionJsonPath}`);
  }
  if (!fs.existsSync(jarPath)) {
    issues.push(`Client JAR not found: ${jarPath}`);
  }

  return {
    version,
    gamePath,
    healthy: issues.length === 0,
    issues,
  };
}
