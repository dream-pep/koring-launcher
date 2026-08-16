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
import { AbortableTask, CancelledError, task, type Task } from '@xmcl/task';
import {
  installTask,
  installDependenciesTask,
  installForgeTask,
  installNeoForgedTask,
  installFabric,
  installQuiltVersion,
  getVersionList,
} from '@xmcl/installer';
import { Version } from '@xmcl/core';
import { rewriteToMirror } from './installer';
import {
  createInstance,
  updateInstance,
  BMCLAPI_VERSION_MANIFEST,
  BMCLAPI_MAVEN,
  BMCLAPI_ASSETS,
  mirrorFetch,
  type InstanceRuntime,
} from './instance';

// 任务执行钩子：主进程用它向渲染进程广播日志
export interface TaskHooks {
  log: (level: 'info' | 'warn' | 'error', message: string) => void;
}

// 实例安装任务参数（与前端 addSidecarTask 的 params 对齐）
export interface InstallTaskParams {
  name: string;
  gamePath: string;
  runtime: InstanceRuntime;
  description?: string;
}

// 模拟任务参数（调试页使用）
export interface SimTaskParams {
  duration?: number;
  failAt?: number;
  failMessage?: string;
  total?: number;
  threads?: number;
  steps?: number;
}

// 执行器工厂：根据参数与钩子创建 @xmcl/task 任务
type ExecutorFactory = (params: Record<string, unknown>, hooks: TaskHooks) => Task<unknown>;

// 执行器注册表：executorName → 工厂
const executorRegistry = new Map<string, ExecutorFactory>();

// ==================== 模拟执行器（调试用）====================

// 模拟任务基类：AbortableTask 子类，支持取消 / 暂停 / 进度
abstract class SimTask extends AbortableTask<number> {
  protected aborted = false;
  protected stepIndex = 0;
  protected stepTotal = 20;

  // 进度展示：已推进的步数 / 总步数
  override get progress(): number {
    return this.stepIndex;
  }
  override get total(): number {
    return this.stepTotal;
  }

  // 每个步骤推进一次进度并抛出日志
  protected step(hooks: TaskHooks, message?: string): void {
    this.stepIndex += 1;
    if (message) hooks.log('info', message);
  }

  // 等待恢复：暂停期间每 50ms 轮询一次，直到恢复或取消
  protected async waitResume(): Promise<void> {
    while (this.isPaused && !this.aborted) {
      await new Promise((r) => setTimeout(r, 50));
    }
    if (this.aborted) throw new CancelledError();
  }

  // 取消回调：标记中止标志
  protected abort(): void {
    this.aborted = true;
  }

  // 判断错误是否为取消导致
  protected isAbortedError(e: unknown): boolean {
    return e instanceof CancelledError || this.aborted;
  }
}

// sleep：按毫秒数模拟耗时任务
class SleepTask extends SimTask {
  constructor(
    private readonly durationMs: number,
    private readonly failAt: number,
    private readonly failMessage: string | undefined,
    private readonly hooks: TaskHooks,
  ) {
    super();
  }

  override async process(): Promise<number> {
    const interval = this.durationMs / this.stepTotal;
    for (let i = 0; i < this.stepTotal; i++) {
      await this.waitResume();
      this.step(this.hooks, `进度 ${Math.round(((i + 1) / this.stepTotal) * 100)}%`);
      if (i + 1 === this.failAt) {
        this.hooks.log('error', this.failMessage ?? '模拟失败：网络连接超时');
        throw new Error(this.failMessage ?? '网络连接超时');
      }
      await new Promise((r) => setTimeout(r, interval));
    }
    this.hooks.log('info', '任务完成');
    return this.stepIndex;
  }
}

// download：模拟分段下载（total 单位，threads 并发）
class DownloadSimTask extends SimTask {
  private done = 0;

  constructor(
    private readonly totalUnits: number,
    private readonly threads: number,
    private readonly hooks: TaskHooks,
  ) {
    super();
    this.stepTotal = totalUnits;
  }

  override get progress(): number {
    return this.done;
  }
  override get total(): number {
    return this.totalUnits;
  }

  override async process(): Promise<number> {
    const chunk = Math.max(1, Math.round(this.totalUnits / this.threads));
    while (this.done < this.totalUnits) {
      await this.waitResume();
      this.done = Math.min(this.totalUnits, this.done + chunk);
      this.hooks.log('info', `已下载 ${this.done}/${this.totalUnits}`);
      await new Promise((r) => setTimeout(r, 120));
    }
    this.hooks.log('info', '下载完成');
    return this.done;
  }
}

// install-sim：模拟多步骤安装（steps 步）
class InstallSimTask extends SimTask {
  constructor(
    private readonly installSteps: number,
    private readonly hooks: TaskHooks,
  ) {
    super();
    this.stepTotal = installSteps;
  }

  override async process(): Promise<number> {
    for (let i = 1; i <= this.installSteps; i++) {
      await this.waitResume();
      this.step(this.hooks, `安装步骤 ${i}/${this.installSteps}`);
      await new Promise((r) => setTimeout(r, 150));
    }
    this.hooks.log('info', '安装完成');
    return this.stepIndex;
  }
}

// 注册模拟执行器
executorRegistry.set('sleep', (raw, hooks) => {
  const p = raw as unknown as SimTaskParams;
  return new SleepTask(p.duration ?? 3000, p.failAt ?? -1, p.failMessage, hooks);
});

executorRegistry.set('download', (raw, hooks) => {
  const p = raw as unknown as SimTaskParams;
  return new DownloadSimTask(p.total ?? 100, p.threads ?? 4, hooks);
});

executorRegistry.set('install-sim', (raw, hooks) => {
  const p = raw as unknown as SimTaskParams;
  return new InstallSimTask(p.steps ?? 10, hooks);
});

// ==================== 真实执行器（实例安装）====================

// install：使用 @xmcl/installer 的 Task 版本函数安装 Minecraft 实例
// 任务树：install.create → install.minecraft → (forge|neoforge|fabric|quilt) → install.dependencies
executorRegistry.set('install', (rawParams, hooks) => {
  const p = rawParams as unknown as InstallTaskParams;
  const { name, gamePath, runtime } = p;
  const instancePath = path.join(gamePath, 'instances', name);

  return task('install', async function () {
    // 子任务 1：创建实例目录
    hooks.log('info', `创建实例: ${name}`);
    await this.yield(
      task('create', async () => {
        await createInstance(name, gamePath, runtime, { description: p.description });
      }),
    );

    // 预步骤：获取版本清单，定位 Minecraft 版本元数据（走 BMCLAPI 镜像）
    const versionList = await getVersionList({ remote: BMCLAPI_VERSION_MANIFEST, fetch: mirrorFetch });
    const versionInfo = versionList.versions.find((v) => v.id === runtime.minecraft);
    if (!versionInfo) {
      throw new Error(`Minecraft 版本 ${runtime.minecraft} 不存在`);
    }

    // 子任务 2：安装 Minecraft 本体（版本 JSON / 客户端 JAR）
    hooks.log('info', `下载 Minecraft ${runtime.minecraft}...`);
    await this.yield(
      installTask(
        { id: versionInfo.id, url: versionInfo.url },
        instancePath,
        {
          // 版本 JSON / 客户端 JAR 走 BMCLAPI 镜像
          json: (v) => rewriteToMirror(v.url),
          client: (v) => (v.downloads?.client ? rewriteToMirror(v.downloads.client.url) : []),
          mavenHost: BMCLAPI_MAVEN,
          assetsHost: BMCLAPI_ASSETS,
        },
      ).setName('minecraft'),
    );

    // 子任务 3：模组加载器（Forge / NeoForge 有 Task 版本；Fabric / Quilt 为 Promise）
    if (runtime.forge) {
      hooks.log('info', `安装 Forge ${runtime.forge}...`);
      await this.yield(
        installForgeTask(
          { version: runtime.forge, mcversion: runtime.minecraft },
          instancePath,
          { mavenHost: BMCLAPI_MAVEN },
        ).setName('forge'),
      );
    }

    if (runtime.fabricLoader) {
      hooks.log('info', `安装 Fabric ${runtime.fabricLoader}...`);
      await installFabric({
        minecraftVersion: runtime.minecraft,
        version: runtime.fabricLoader,
        minecraft: instancePath,
        fetch: mirrorFetch,
      });
    }

    if (runtime.quiltLoader) {
      hooks.log('info', `安装 Quilt ${runtime.quiltLoader}...`);
      await installQuiltVersion({
        minecraftVersion: runtime.minecraft,
        version: runtime.quiltLoader,
        minecraft: instancePath,
      });
    }

    if (runtime.neoForged) {
      hooks.log('info', `安装 NeoForge ${runtime.neoForged}...`);
      await this.yield(
        installNeoForgedTask('neoforge', runtime.neoForged, instancePath, { mavenHost: BMCLAPI_MAVEN }).setName('neoforge'),
      );
    }

    // 子任务 4：安装依赖（libraries + assets）
    hooks.log('info', '安装依赖...');
    const resolved = await Version.parse(instancePath, runtime.minecraft);
    await this.yield(
      installDependenciesTask(resolved, { mavenHost: BMCLAPI_MAVEN, assetsHost: BMCLAPI_ASSETS }).setName('dependencies'),
    );

    // 收尾：更新实例最近访问时间
    await updateInstance(name, gamePath, { lastAccessDate: Date.now() });
    hooks.log('info', `实例「${name}」创建完成`);
  });
});

// ==================== 对外接口 ====================

// 根据执行器名称创建 @xmcl/task 任务；未知执行器返回 undefined
export function createXmclTask(
  executorName: string,
  params: Record<string, unknown>,
  hooks: TaskHooks,
): Task<unknown> | undefined {
  const factory = executorRegistry.get(executorName);
  return factory ? factory(params, hooks) : undefined;
}

// 将 @xmcl/task 的 path 映射为前端展示的阶段文案
const STAGE_MAP: [RegExp, string][] = [
  [/^install\.create/, '创建实例'],
  [/^install\.minecraft/, '下载 Minecraft'],
  [/^install\.forge/, '安装 Forge'],
  [/^install\.neoforge/, '安装 NeoForge'],
  [/^install\.fabric/, '安装 Fabric'],
  [/^install\.quilt/, '安装 Quilt'],
  [/^install\.dependencies/, '安装依赖'],
  [/^sleep/, '模拟计时'],
  [/^download/, '模拟下载'],
  [/^install-sim/, '模拟安装'],
];

export function stageFromPath(taskPath: string): string {
  for (const [pattern, label] of STAGE_MAP) {
    if (pattern.test(taskPath)) return label;
  }
  return taskPath || '执行中';
}
