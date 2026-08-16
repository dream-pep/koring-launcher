import { useTaskStore } from "@/stores/taskStore";
import { useRouteStore } from "@/stores/routeStore";
import type { TaskType } from "@/types/task";
import { GlassCard, PageHeader } from "./components";
import {
  Download,
  ArrowDownToLine,
  RefreshCw,
  Play,
  User,
  Zap,
  Trash2,
  ListTodo,
  AlertCircle,
  Check,
  Ban,
  Server,
  Pause,
} from "lucide-react";

const taskTypes: { type: TaskType; label: string; icon: typeof Download; color: string; bg: string }[] = [
  { type: "install", label: "安装", icon: Download, color: "text-blue-500", bg: "bg-blue-500/10" },
  { type: "download", label: "下载", icon: ArrowDownToLine, color: "text-cyan-500", bg: "bg-cyan-500/10" },
  { type: "update", label: "更新", icon: RefreshCw, color: "text-purple-500", bg: "bg-purple-500/10" },
  { type: "launch", label: "启动", icon: Play, color: "text-green-500", bg: "bg-green-500/10" },
  { type: "auth", label: "认证", icon: User, color: "text-amber-500", bg: "bg-amber-500/10" },
  { type: "sync", label: "同步", icon: RefreshCw, color: "text-indigo-500", bg: "bg-indigo-500/10" },
  { type: "custom", label: "自定义", icon: Zap, color: "text-gray-500", bg: "bg-gray-500/10" },
];

/** Local task simulation (runs in browser) */
function simulateLocalTask(type: TaskType, title: string, duration: number, shouldFail = false) {
  useTaskStore.getState().addTask(type, title, `本地模拟 ${duration / 1000}s`, async (ctx) => {
    const steps = 20;
    const interval = duration / steps;
    for (let i = 0; i <= steps; i++) {
      if (ctx.abortSignal.aborted) throw new Error("已取消");
      ctx.updateProgress({ current: i, total: steps, stage: `步骤 ${i}/${steps}` });
      ctx.addLog("info", `进度 ${Math.round((i / steps) * 100)}%`);
      if (i === Math.floor(steps / 2)) {
        ctx.addLog("warn", "中间检查点");
      }
      if (shouldFail && i === steps - 2) {
        ctx.addLog("error", "模拟失败：网络连接超时");
        throw new Error("网络连接超时");
      }
      await new Promise((r) => setTimeout(r, interval));
    }
    ctx.addLog("info", "任务完成");
  });
}

/** IPC @xmcl/task simulation (runs in main process via AbortableTask) */
function simulateSidecarTask(
  type: TaskType,
  title: string,
  executorName: string,
  params: Record<string, unknown>,
) {
  useTaskStore.getState().addSidecarTask({
    type,
    title,
    description: `IPC @xmcl/task: ${executorName}`,
    executorName,
    params,
  });
}

const statusIcons = {
  pending: RefreshCw,
  running: RefreshCw,
  paused: Pause,
  completed: Check,
  failed: AlertCircle,
  cancelled: Ban,
};

export function TaskDebug() {
  const tasks = useTaskStore((s) => s.tasks);
  const clearHistory = useTaskStore((s) => s.clearHistory);
  const removeTask = useTaskStore((s) => s.removeTask);
  const navigate = useRouteStore((s) => s.navigate);

  const running = tasks.filter((t) => t.status === "running").length;
  const pending = tasks.filter((t) => t.status === "pending").length;
  const completed = tasks.filter((t) => t.status === "completed").length;
  const failed = tasks.filter((t) => t.status === "failed").length;

  return (
    <div className="max-w-2xl mx-auto p-8">
      <PageHeader title="任务队列调试" desc="测试 @xmcl/task 任务调度、进度条、日志与任务队列页面" />

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-8">
        {[
          { label: "运行中", value: running, color: "text-blue-500" },
          { label: "等待中", value: pending, color: "text-muted-foreground" },
          { label: "已完成", value: completed, color: "text-green-500" },
          { label: "失败", value: failed, color: "text-red-500" },
        ].map((s) => (
          <GlassCard key={s.label}>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
            <p className={`text-2xl font-bold tabular-nums mt-1 ${s.color}`}>{s.value}</p>
          </GlassCard>
        ))}
      </div>

      {/* Quick actions */}
      <div className="mb-8">
        <h3 className="text-sm font-semibold text-foreground/40 uppercase tracking-wider mb-3">
          快速操作
        </h3>
        <div className="space-y-3">
          <GlassCard>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-foreground">打开任务队列</p>
                <p className="text-[13px] text-muted-foreground mt-0.5">跳转到任务队列页面查看当前任务列表</p>
              </div>
              <button
                onClick={() => navigate("task-queue")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground/[0.06] hover:bg-foreground/[0.1] text-sm font-medium transition-colors"
              >
                <ListTodo className="w-4 h-4" />
                打开
              </button>
            </div>
          </GlassCard>
          <GlassCard>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-foreground">清空所有历史</p>
                <p className="text-[13px] text-muted-foreground mt-0.5">删除 localStorage 中的任务记录</p>
              </div>
              <button
                onClick={clearHistory}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive text-sm font-medium transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                清空
              </button>
            </div>
          </GlassCard>
          <GlassCard>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-foreground">暂停 / 恢复测试</p>
                <p className="text-[13px] text-muted-foreground mt-0.5">运行 5s 计时任务，3 秒后自动暂停，验证 @xmcl/task 的 Paused 状态</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const id = simulateSidecarTask("custom", "暂停/恢复测试 (5s)", "sleep", { duration: 5000 });
                    // 3 秒后自动暂停，验证 Paused 状态
                    setTimeout(() => useTaskStore.getState().pauseTask(id), 3000);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-foreground/[0.06] hover:bg-foreground/[0.1] text-[12px] font-medium transition-colors"
                >
                  <Pause className="w-3.5 h-3.5" />
                  运行并暂停
                </button>
                <button
                  onClick={() => {
                    const paused = useTaskStore.getState().tasks.find((t) => t.status === "paused");
                    if (paused) useTaskStore.getState().resumeTask(paused.id);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-foreground/[0.06] hover:bg-foreground/[0.1] text-[12px] font-medium transition-colors"
                >
                  <Play className="w-3.5 h-3.5" />
                  恢复
                </button>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>

      {/* Sidecar @xmcl/task executors */}
      <div className="mb-8">
        <h3 className="text-sm font-semibold text-foreground/40 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Server className="w-4 h-4" />
          Sidecar @xmcl/task 执行器
        </h3>
        <div className="space-y-3">
          <GlassCard>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-foreground">sleep 执行器</p>
                <p className="text-[13px] text-muted-foreground mt-0.5">3s 计时任务，AbortableTask + 进度追踪</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => simulateSidecarTask("custom", "Sidecar Sleep 3s", "sleep", { duration: 3000 })}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-foreground/[0.06] hover:bg-foreground/[0.1] text-[12px] font-medium transition-colors"
                >
                  成功
                </button>
                <button
                  onClick={() =>
                    simulateSidecarTask("custom", "Sidecar Sleep (失败)", "sleep", {
                      duration: 3000,
                      failAt: 10,
                      failMessage: "模拟 IPC 任务失败",
                    })
                  }
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive text-[12px] font-medium transition-colors"
                >
                  失败
                </button>
              </div>
            </div>
          </GlassCard>
          <GlassCard>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-foreground">download 执行器</p>
                <p className="text-[13px] text-muted-foreground mt-0.5">模拟下载 100 单位，分块进度更新</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    simulateSidecarTask("download", "Sidecar Download", "download", { total: 100, threads: 4 })
                  }
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-foreground/[0.06] hover:bg-foreground/[0.1] text-[12px] font-medium transition-colors"
                >
                  运行
                </button>
              </div>
            </div>
          </GlassCard>
          <GlassCard>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-foreground">install 执行器</p>
                <p className="text-[13px] text-muted-foreground mt-0.5">模拟安装 10 步骤，每步 200ms</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => simulateSidecarTask("install", "Sidecar Install", "install-sim", { steps: 10 })}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-foreground/[0.06] hover:bg-foreground/[0.1] text-[12px] font-medium transition-colors"
                >
                  运行
                </button>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>

      {/* Local browser tasks */}
      <div className="mb-8">
        <h3 className="text-sm font-semibold text-foreground/40 uppercase tracking-wider mb-3">
          本地浏览器任务
        </h3>
        <div className="space-y-3">
          {taskTypes.map((tt) => (
            <GlassCard key={tt.type}>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${tt.bg}`}>
                    <tt.icon className={`w-4 h-4 ${tt.color}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{tt.label}任务</p>
                    <p className="text-[13px] text-muted-foreground mt-0.5">本地模拟 3s</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => simulateLocalTask(tt.type, `模拟${tt.label}任务`, 3000)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-foreground/[0.06] hover:bg-foreground/[0.1] text-[12px] font-medium transition-colors"
                  >
                    成功
                  </button>
                  <button
                    onClick={() => simulateLocalTask(tt.type, `模拟${tt.label}任务(失败)`, 3000, true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive text-[12px] font-medium transition-colors"
                  >
                    失败
                  </button>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      </div>

      {/* Batch test */}
      <div className="mb-8">
        <h3 className="text-sm font-semibold text-foreground/40 uppercase tracking-wider mb-3">
          批量测试
        </h3>
        <div className="space-y-3">
          <GlassCard>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-foreground">并行本地+Sidecar任务</p>
                <p className="text-[13px] text-muted-foreground mt-0.5">同时运行本地和 IPC 任务，验证混合执行</p>
              </div>
              <button
                onClick={() => {
                  simulateLocalTask("install", "本地安装", 4000);
                  simulateSidecarTask("download", "Sidecar下载", "download", { total: 80, threads: 4 });
                  simulateSidecarTask("custom", "Sidecar同步", "sleep", { duration: 5000 });
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-foreground/[0.06] hover:bg-foreground/[0.1] text-sm font-medium transition-colors"
              >
                <Zap className="w-4 h-4" />
                运行
              </button>
            </div>
          </GlassCard>
          <GlassCard>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-foreground">取消任务测试</p>
                <p className="text-[13px] text-muted-foreground mt-0.5">Sidecar 5s 长任务，可在任务队列中取消</p>
              </div>
              <button
                onClick={() => simulateSidecarTask("download", "可取消任务", "sleep", { duration: 5000 })}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-foreground/[0.06] hover:bg-foreground/[0.1] text-sm font-medium transition-colors"
              >
                <Ban className="w-4 h-4" />
                运行
              </button>
            </div>
          </GlassCard>
        </div>
      </div>

      {/* Task list */}
      {tasks.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground/40 uppercase tracking-wider mb-3">
            当前任务 ({tasks.length})
          </h3>
          <div className="space-y-2">
            {tasks.map((t) => {
              const StatusIcon = statusIcons[t.status];
              return (
                <GlassCard key={t.id}>
                  <div className="flex items-center gap-3">
                    <StatusIcon
                      className={`w-4 h-4 shrink-0 ${
                        t.status === "running"
                          ? "animate-spin text-blue-500"
                          : t.status === "paused"
                          ? "text-amber-500"
                          : t.status === "completed"
                          ? "text-green-500"
                          : t.status === "failed"
                          ? "text-red-500"
                          : "text-muted-foreground"
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{t.title}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {t.type} · {t.status} · {t.logs.length} 条日志
                        {t.xmclState && <span className="ml-1 text-primary/60">@{t.xmclState}</span>}
                        {t.xmclPath && <span className="ml-1 text-primary/60">xmcl:{t.xmclPath}</span>}
                      </p>
                    </div>
                    <button
                      onClick={() => removeTask(t.id)}
                      className="p-1 rounded hover:bg-muted/50 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </div>
                </GlassCard>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
