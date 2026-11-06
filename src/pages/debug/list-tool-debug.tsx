import { useState } from "react";
import { useTaskStore } from "@/stores/taskStore";
import { useNoticeStore } from "@/stores/noticeStore";
import { useTaskPanelStore } from "@/stores/taskPanelStore";
import { toast, type ToastOptions } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GlassCard, PageHeader } from "./components";
import {
  Ban,
  Bell,
  BellRing,
  Hourglass,
  Infinity as InfinityIcon,
  ListTodo,
  PanelRightOpen,
  Plus,
  Send,
  Trash2,
} from "lucide-react";

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** 倒计时任务的最小/最大秒数（仅本调试页使用） */
const MIN_SECONDS = 1;
const MAX_SECONDS = 600;

/** 通知类型选项（与 `@/lib/toast` 门面一一对应） */
const NOTIFY_TYPES = [
  { key: "success", label: "成功" },
  { key: "info", label: "信息" },
  { key: "warning", label: "警告" },
  { key: "error", label: "错误" },
] as const;

type NotifyType = (typeof NOTIFY_TYPES)[number]["key"];

/** 分组小标题 */
function GroupTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold text-foreground/40 uppercase tracking-wider mb-3">
      {children}
    </h3>
  );
}

/** 可选的小按钮（与调试页其它工具保持同一套视觉） */
function TinyButton({
  children,
  onClick,
  danger = false,
  disabled = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        danger
          ? "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive text-[12px] font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none"
          : "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-foreground/[0.06] hover:bg-foreground/[0.1] text-[12px] font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none"
      }
    >
      {children}
    </button>
  );
}

const STATUS_TEXT: Record<string, string> = {
  pending: "等待中",
  running: "进行中",
  paused: "已暂停",
  completed: "已完成",
  failed: "失败",
  cancelled: "已取消",
};

/**
 * List 工具（开发者调试）。
 *
 * 用于手工构造「任务列表 / 通知列表」中的数据：
 * - 自由填写任务标题与描述，创建永不结束或带倒计时的一次性任务；
 * - 自由构造一条通知（类型 / 标题 / 描述 / 是否常驻）；
 * - 所有任务都是渲染端本地任务（type = custom），只在内存里，关闭启动器即消失。
 */
export function ListToolDebug() {
  const tasks = useTaskStore((s) => s.tasks);
  const toastCount = useNoticeStore((s) => s.toastHistory.length);

  // 任务表单
  const [title, setTitle] = useState("自定义任务");
  const [description, setDescription] = useState("来自 List 工具的自定义任务");
  const [mode, setMode] = useState<"infinite" | "countdown">("countdown");
  const [seconds, setSeconds] = useState("10");
  const [createdIds, setCreatedIds] = useState<string[]>([]);

  // 通知表单
  const [notifyTitle, setNotifyTitle] = useState("自定义通知");
  const [notifyDesc, setNotifyDesc] = useState("由 List 工具插入的测试通知");
  const [notifyType, setNotifyType] = useState<NotifyType>("info");
  const [notifyPersistent, setNotifyPersistent] = useState(false);

  const createdTasks = createdIds
    .map((id) => tasks.find((t) => t.id === id))
    .filter((t): t is NonNullable<typeof t> => Boolean(t));

  const createTask = () => {
    const finalTitle = title.trim() || "自定义任务";
    const finalDesc = description.trim() || undefined;
    const clampedSeconds = Math.min(
      MAX_SECONDS,
      Math.max(MIN_SECONDS, Math.round(Number(seconds) || MIN_SECONDS)),
    );

    const id = useTaskStore.getState().addTask("custom", finalTitle, finalDesc, async (ctx) => {
      if (mode === "infinite") {
        ctx.addLog("info", "永不结束任务已创建，可在任务面板或下方列表中取消");
        let tick = 0;
        while (!ctx.abortSignal.aborted) {
          tick += 1;
          ctx.updateProgress({
            current: tick % 100,
            total: 100,
            stage: `永不结束 · 第 ${tick} 个循环`,
          });
          if (tick % 10 === 0) ctx.addLog("info", `已持续运行 ${Math.round(tick * 0.5)} 秒`);
          await sleep(500);
        }
        throw new Error("已取消");
      }

      // 倒计时：每 100ms 推进一次，进度条走满即完成
      const total = clampedSeconds * 10;
      ctx.addLog("info", `倒计时任务开始：${clampedSeconds} 秒`);
      for (let i = 0; i <= total; i += 1) {
        if (ctx.abortSignal.aborted) throw new Error("已取消");
        const remainMs = Math.max(0, (total - i) * 100);
        ctx.updateProgress({
          current: i,
          total,
          stage: `剩余 ${(remainMs / 1000).toFixed(1)}s`,
        });
        if (i > 0 && i % 10 === 0) {
          ctx.addLog("info", `剩余 ${Math.ceil(remainMs / 1000)} 秒`);
        }
        if (i < total) await sleep(100);
      }
      ctx.addLog("info", "倒计时结束，任务完成");
    });

    setCreatedIds((prev) => [id, ...prev].slice(0, 12));
  };

  const sendNotification = () => {
    const finalTitle = notifyTitle.trim() || "自定义通知";
    const options: ToastOptions = notifyDesc.trim() ? { description: notifyDesc.trim() } : {};

    if (notifyPersistent) {
      toast.persistent(finalTitle, options);
      return;
    }
    switch (notifyType) {
      case "success":
        toast.success(finalTitle, options);
        break;
      case "warning":
        toast.warning(finalTitle, options);
        break;
      case "error":
        toast.error(finalTitle, options);
        break;
      default:
        toast.info(finalTitle, options);
        break;
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-8">
      <PageHeader
        title="List 工具"
        desc="自定义任务的标题与描述，创建永不结束或倒计时任务，并向通知列表插入自定义通知"
      />

      <div className="space-y-6">
        {/* 自定义任务 */}
        <div>
          <GroupTitle>自定义任务</GroupTitle>
          <GlassCard>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-[12px] text-muted-foreground">任务标题</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="例如：启动 1.20.1-Fabric"
                  aria-label="任务标题"
                  className="h-8"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] text-muted-foreground">任务描述</label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="显示在标题下方的一行说明（可留空）"
                  aria-label="任务描述"
                  className="h-8"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[12px] text-muted-foreground">结束方式</span>
                <Button
                  size="sm"
                  variant={mode === "infinite" ? "default" : "outline"}
                  onClick={() => setMode("infinite")}
                  className="gap-1.5"
                >
                  <InfinityIcon className="h-3.5 w-3.5" />
                  永不结束
                </Button>
                <Button
                  size="sm"
                  variant={mode === "countdown" ? "default" : "outline"}
                  onClick={() => setMode("countdown")}
                  className="gap-1.5"
                >
                  <Hourglass className="h-3.5 w-3.5" />
                  倒计时
                </Button>
                {mode === "countdown" && (
                  <label className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                    <Input
                      type="number"
                      min={MIN_SECONDS}
                      max={MAX_SECONDS}
                      value={seconds}
                      onChange={(e) => setSeconds(e.target.value)}
                      aria-label="倒计时秒数"
                      className="h-8 w-20 text-foreground"
                    />
                    秒
                  </label>
                )}
                <Button size="sm" onClick={createTask} className="ml-auto gap-1.5">
                  <Plus className="h-3.5 w-3.5" />
                  添加任务
                </Button>
              </div>
              <p className="text-[12px] text-muted-foreground">
                任务会出现在右上角任务按钮与任务面板的「进行中」列表；永不结束的任务需要手动取消。
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <TinyButton onClick={() => useTaskPanelStore.getState().openPanel()}>
                  <PanelRightOpen className="h-3.5 w-3.5" />
                  打开任务面板
                </TinyButton>
                <TinyButton
                  onClick={() => useTaskStore.getState().clearHistory()}
                  disabled={!tasks.some((t) =>
                    ["completed", "failed", "cancelled"].includes(t.status),
                  )}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  清空历史任务
                </TinyButton>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* 自定义通知 */}
        <div>
          <GroupTitle>自定义通知</GroupTitle>
          <GlassCard>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-[12px] text-muted-foreground">通知标题</label>
                <Input
                  value={notifyTitle}
                  onChange={(e) => setNotifyTitle(e.target.value)}
                  placeholder="通知正文"
                  aria-label="通知标题"
                  className="h-8"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] text-muted-foreground">通知描述</label>
                <Input
                  value={notifyDesc}
                  onChange={(e) => setNotifyDesc(e.target.value)}
                  placeholder="可选的一行补充说明"
                  aria-label="通知描述"
                  className="h-8"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[12px] text-muted-foreground">类型</span>
                {NOTIFY_TYPES.map((t) => (
                  <Button
                    key={t.key}
                    size="sm"
                    variant={notifyType === t.key ? "default" : "outline"}
                    onClick={() => setNotifyType(t.key)}
                  >
                    {t.label}
                  </Button>
                ))}
                <Button
                  size="sm"
                  variant={notifyPersistent ? "default" : "outline"}
                  onClick={() => setNotifyPersistent((v) => !v)}
                  className="gap-1.5"
                >
                  <BellRing className="h-3.5 w-3.5" />
                  常驻
                </Button>
                <Button size="sm" onClick={sendNotification} className="ml-auto gap-1.5">
                  <Send className="h-3.5 w-3.5" />
                  发送通知
                </Button>
              </div>
              <p className="text-[12px] text-muted-foreground">
                通知会以右下角弹窗出现，同时写入任务面板的「通知」历史（当前 {toastCount} 条）。
                常驻通知不会自动消失，需要手动关闭。
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <TinyButton
                  onClick={() => {
                    useNoticeStore.getState().clearToasts();
                    toast.info("已清空通知历史");
                  }}
                  disabled={toastCount === 0}
                >
                  <Bell className="h-3.5 w-3.5" />
                  清空通知历史
                </TinyButton>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* 本次创建的任务 */}
        {createdTasks.length > 0 && (
          <div>
            <GroupTitle>本次创建的任务</GroupTitle>
            <div className="space-y-2">
              {createdTasks.map((task) => (
                <GlassCard key={task.id}>
                  <div className="flex items-center gap-3">
                    <ListTodo className="h-4 w-4 shrink-0 text-foreground/50" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{task.title}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {task.description ?? "无描述"} · {STATUS_TEXT[task.status] ?? task.status}
                        {task.progress && (
                          <span className="ml-1 tabular-nums">
                            · {task.progress.current}/{task.progress.total}
                            {task.progress.stage ? ` · ${task.progress.stage}` : ""}
                          </span>
                        )}
                      </p>
                    </div>
                    {task.status === "running" || task.status === "pending" ? (
                      <TinyButton
                        danger
                        onClick={() => useTaskStore.getState().cancelTask(task.id)}
                      >
                        <Ban className="h-3.5 w-3.5" />
                        取消
                      </TinyButton>
                    ) : (
                      <TinyButton
                        onClick={() => useTaskStore.getState().removeTask(task.id)}
                        danger
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        移除
                      </TinyButton>
                    )}
                  </div>
                </GlassCard>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
