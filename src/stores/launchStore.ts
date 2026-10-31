import { create } from "zustand";
import { launchGame, onGameEvent, diagnoseVersion, waitForGameReady } from "../api/launch";
import type { LaunchResult, LaunchServer } from "../api/launch";
import {
  diagnoseInstance,
  repairInstanceAndWait,
  verifyInstance,
  type InstanceDependencyInfo,
  type InstanceIntegrityInfo,
} from "../api/instance";
import { getJavaPlan, resolveJava, scanJava } from "../api/java";
import { toast } from "../lib/toast";
import { useAuthStore } from "./authStore";
import { useConfigStore } from "./configStore";
import { useTaskStore } from "./taskStore";
import { useTaskPanelStore } from "./taskPanelStore";

interface GameEvent {
  event: string;
  [key: string]: unknown;
}

/** 「核验 → 补全 → 启动」流水线的可选参数 */
export interface LaunchPreparedOptions {
  /** 实例昵称（任务标题用，缺省为实例名） */
  displayName?: string;
  /** 实例的 Minecraft 版本号（Java 需求匹配用） */
  minecraftVersion?: string;
  /** 快速联机目标服务器 */
  server?: LaunchServer;
}

/** 修复阶段 → 任务日志可读文案 */
const REPAIR_STAGE_LABELS: Record<string, string> = {
  "installing-minecraft": "正在补齐版本文件",
  "installing-loader": "正在补齐模组加载器",
  "installing-dependencies": "正在校验依赖库与资源",
  done: "补全完成",
};

function stageLabel(stage: string): string {
  return REPAIR_STAGE_LABELS[stage] ?? stage;
}

/** 把依赖体检结果翻译成一句话（「缺少 X；缺少 Y」） */
function describeMissing(dependency: InstanceDependencyInfo): string {
  const parts: string[] = [];
  if (dependency.missingJar) parts.push("缺少客户端 jar");
  if (dependency.missingAssetIndex) parts.push("缺少资源索引");
  if (dependency.missingVersions.length > 0) {
    const shown = dependency.missingVersions.slice(0, 3).join("、");
    const more = dependency.missingVersions.length > 3 ? " 等" : "";
    parts.push(`缺少版本文件：${shown}${more}`);
  }
  if (dependency.missingLibraries > 0) parts.push(`缺少 ${dependency.missingLibraries} 个依赖库`);
  return parts.join("；");
}

/** 把主进程抛出的技术错误翻译成用户能看懂的提示（原始信息仍写入任务日志） */
function friendlyError(message: string): string {
  if (/Corrupted Version jar|sha1 not matched/i.test(message)) {
    return "游戏文件校验失败（客户端 JAR 可能已损坏），请在实例详情执行一次「修复」后重试启动。";
  }
  if (/Missing \d+ libraries/i.test(message)) {
    return "游戏依赖库校验失败（文件可能已损坏），请在实例详情执行一次「修复」后重试启动。";
  }
  if (/窗口就绪前退出/.test(message)) {
    return "游戏在显示窗口前就退出了（常见原因：模组与 Java 版本不兼容、显卡驱动异常或资源缺失），任务日志里有游戏的最后输出。";
  }
  return message;
}

/** 核验 Java：配置路径 → 按版本自动匹配 → 系统扫描，都没有则抛错 */
async function ensureJavaAvailable(
  minecraftVersion: string | undefined,
  warn: (message: string) => void
): Promise<void> {
  const java = useConfigStore.getState().config.java;
  if (java.javaPath) {
    const info = await resolveJava(java.javaPath).catch(() => null);
    if (info) return;
    warn(`配置的 Java 路径不可用：${java.javaPath}，改用自动匹配`);
  }

  if (minecraftVersion) {
    const plan = await getJavaPlan(minecraftVersion).catch(() => null);
    if (plan?.pickedPath) return;
    const scanned = await scanJava().catch(() => []);
    if (scanned.length > 0) return;
    throw new Error(
      plan?.requiredMajor
        ? `未找到可用的 Java（需要 Java ${plan.requiredMajor}），请到 设置 → 游戏 → Java 中配置`
        : "未找到可用的 Java，请到 设置 → 游戏 → Java 中配置"
    );
  }

  const scanned = await scanJava().catch(() => []);
  if (scanned.length === 0) {
    throw new Error("未找到可用的 Java，请到 设置 → 游戏 → Java 中配置");
  }
}

/** 让长任务可被任务取消及时中断（底层 IPC 可能仍在主进程继续，忽略其结果即可） */
function raceAbort<T>(task: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(new Error("已取消"));
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new Error("已取消"));
    signal.addEventListener("abort", onAbort, { once: true });
    task.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      }
    );
  });
}

interface LaunchState {
  /** 正在发起启动请求 */
  launching: boolean;
  /** 游戏进程正在运行 */
  running: boolean;
  gameResult: LaunchResult | null;
  events: GameEvent[];
  error: string | null;

  /**
   * 统一启动入口：指定实例 + 游戏根目录（可选快速联机）。
   * 账户档案从 authStore 自动获取；启动参数（Java/内存/GC/窗口等）由主进程读取权威配置自动应用。
   */
  launch: (instanceName: string, gamePath: string, server?: LaunchServer) => Promise<void>;
  /**
   * 完整启动流水线：核验 → 补全 → 启动 → 窗口就绪后最小化。
   * 全过程挂在任务列表里（type = launch），进度与日志写入对应任务。
   */
  launchPrepared: (
    instanceName: string,
    gamePath: string,
    options?: LaunchPreparedOptions
  ) => Promise<void>;
  diagnose: (gamePath: string, version: string) => Promise<void>;
  reset: () => void;
  clearError: () => void;
}

export const useLaunchStore = create<LaunchState>((set, get) => ({
  launching: false,
  running: false,
  gameResult: null,
  events: [],
  error: null,

  launch: async (instanceName: string, gamePath: string, server?: LaunchServer) => {
    const user = useAuthStore.getState().user;
    if (!user?.username || !user?.uuid) {
      set({ error: "请先在设置中登录账号", launching: false });
      return;
    }

    set({ launching: true, running: false, error: null, events: [], gameResult: null });
    try {
      const result = await launchGame({
        instanceName,
        gamePath,
        profile: {
          username: user.username,
          uuid: user.uuid,
          accessToken: user.accessToken || undefined,
        },
        server,
      });
      set({ gameResult: result, launching: false, running: true });

      // 订阅事件流（stdout / stderr / window-ready / exit）
      const unlisten = onGameEvent(result.requestId, (event) => {
        set((state) => ({ events: [...state.events, event] }));
        if (event.event === "exit") {
          set({ running: false });
          unlisten();
        }
      });
    } catch (e: any) {
      set({ error: e?.message || String(e), launching: false, running: false });
    }
  },

  launchPrepared: async (
    instanceName: string,
    gamePath: string,
    options: LaunchPreparedOptions = {}
  ) => {
    const user = useAuthStore.getState().user;
    if (!user?.username || !user?.uuid) {
      set({ error: "请先在设置中登录账号", launching: false });
      return;
    }

    const state = get();
    if (state.launching) return;
    if (state.running) {
      toast.warning("游戏已在运行");
      return;
    }
    const pendingLaunch = useTaskStore
      .getState()
      .tasks.some(
        (task) =>
          task.type === "launch" && (task.status === "running" || task.status === "pending")
      );
    if (pendingLaunch) return;

    const displayName = options.displayName || instanceName;
    set({ launching: true, running: false, error: null, events: [], gameResult: null });

    useTaskStore.getState().addTask(
      "launch",
      `启动 ${displayName}`,
      "核验 → 补全 → 启动",
      async (ctx) => {
        // 游戏进程的最后若干行 stderr：启动失败时写进任务日志，方便定位崩溃原因
        const stderrTail: string[] = [];
        try {
          // 1) 核验：本地依赖体检 + Java 可用性
          ctx.updateProgress({ current: 0, total: 3, stage: "核验启动环境" });
          ctx.addLog("info", `开始核验实例「${displayName}」…`);
          const diag = await diagnoseInstance(instanceName, gamePath);
          diag.issues.forEach((issue) => ctx.addLog("warn", issue));
          diag.launch.warnings.forEach((warning) => ctx.addLog("warn", warning));

          // 存在性体检之外再做一次深度校验：文件「在」不代表「对」
          // （导入/下载中断的实例常出现 jar 或依赖库大小/SHA1 与清单不符）
          const integrity: InstanceIntegrityInfo | null = await verifyInstance(
            instanceName,
            gamePath
          ).catch((error: unknown) => {
            const message = error instanceof Error ? error.message : String(error);
            ctx.addLog("warn", `文件校验失败：${message}`);
            return null;
          });
          integrity?.problems.forEach((problem) => ctx.addLog("warn", problem));

          await ensureJavaAvailable(
            options.minecraftVersion ?? diag.launch.versionId,
            (message) => ctx.addLog("warn", message)
          );

          const needsRepair =
            !diag.dependency.ready ||
            diag.dependency.missingJar ||
            diag.dependency.missingAssetIndex ||
            diag.dependency.missingVersions.length > 0 ||
            Boolean(integrity && !integrity.ready);
          if (needsRepair) {
            const reasons = [describeMissing(diag.dependency), integrity?.problems.join("；")]
              .filter(Boolean)
              .join("；");
            ctx.addLog("warn", `核验发现缺失：${reasons || "依赖文件不完整"}`);
          } else {
            ctx.addLog("info", "版本文件与依赖库完整，跳过补全");
          }

          // 2) 补全：只补齐缺失内容，补完再体检一次
          ctx.updateProgress({ current: 1, total: 3, stage: "补全启动文件" });
          if (needsRepair) {
            await raceAbort(
              repairInstanceAndWait(instanceName, gamePath, (progress) => {
                if (ctx.abortSignal.aborted) return;
                ctx.updateProgress({
                  current: 1,
                  total: 3,
                  stage: `补全：${stageLabel(progress.stage)}`,
                });
                if (progress.message) ctx.addLog("info", progress.message);
              }),
              ctx.abortSignal
            );
            if (ctx.abortSignal.aborted) throw new Error("已取消");

            const after = await diagnoseInstance(instanceName, gamePath);
            after.issues.forEach((issue) => ctx.addLog("warn", issue));
            const afterIntegrity = await verifyInstance(instanceName, gamePath).catch(() => null);
            const remaining = [
              !after.dependency.ready
                ? describeMissing(after.dependency) || after.issues.join("；") || "依赖文件不完整"
                : "",
              afterIntegrity && !afterIntegrity.ready ? afterIntegrity.problems.join("；") : "",
            ].filter(Boolean);
            if (remaining.length > 0) {
              throw new Error(`补全后文件仍未就绪：${remaining.join("；")}`);
            }
            ctx.addLog("info", "补全完成");
          }
          if (ctx.abortSignal.aborted) throw new Error("已取消");

          // 3) 启动：spawn 后等窗口就绪，再最小化启动器
          ctx.updateProgress({ current: 2, total: 3, stage: "启动游戏" });
          const result = await launchGame({
            instanceName,
            gamePath,
            profile: {
              username: user.username,
              uuid: user.uuid,
              accessToken: user.accessToken || undefined,
            },
            server: options.server,
          });
          set({ gameResult: result });
          ctx.addLog(
            "info",
            `游戏进程已启动（pid ${result.pid}，版本 ${result.version}）`
          );

          // 进程退出时恢复「游戏中」状态；同时缓存游戏 stderr 便于失败诊断
          const unlisten = onGameEvent(result.requestId, (event) => {
            set((prev) => ({ events: [...prev.events, event] }));
            if (event.event === "stderr" && typeof event.message === "string") {
              const lines = event.message.split(/\r?\n/).filter((line) => line.trim());
              stderrTail.push(...lines);
              if (stderrTail.length > 60) stderrTail.splice(0, stderrTail.length - 60);
            }
            if (event.event === "exit") {
              set({ running: false });
              unlisten();
            }
          });

          await waitForGameReady(result.requestId, {
            onWarning: (message) => ctx.addLog("warn", message),
          });
          set({ running: true });

          ctx.updateProgress({ current: 2, total: 3, stage: "最小化启动器" });
          try {
            await window.electronAPI?.minimize();
            ctx.addLog("info", "游戏窗口已就绪，启动器已最小化");
          } catch {
            // 窗口可能已被「启动后行为」设置关闭，最小化失败不影响启动结果
            ctx.addLog("warn", "启动器窗口不可用，跳过最小化");
          }

          ctx.updateProgress({ current: 3, total: 3, stage: "启动完成" });
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          const cancelled = message === "已取消";
          const hint = cancelled ? message : friendlyError(message);
          set({ error: cancelled ? null : hint, launching: false, running: false });
          // 任务日志保留原始错误（含路径/退出码），弹窗用可读版本
          ctx.addLog(cancelled ? "warn" : "error", message);
          if (stderrTail.length > 0) {
            const tail = stderrTail.slice(-15);
            ctx.addLog("error", `游戏输出（最后 ${tail.length} 行）：`);
            tail.forEach((line) => ctx.addLog("error", line));
          }
          if (cancelled) {
            toast.info("已取消启动");
          } else {
            toast.error(`启动失败：${hint}`);
          }
          throw e;
        } finally {
          set({ launching: false });
        }
      }
    );

    useTaskPanelStore.getState().openPanel();
  },

  diagnose: async (gamePath: string, version: string) => {
    try {
      await diagnoseVersion(gamePath, version);
    } catch (e: any) {
      set({ error: e.message });
    }
  },

  reset: () => {
    set({ launching: false, running: false, gameResult: null, events: [], error: null });
  },

  clearError: () => set({ error: null }),
}));
