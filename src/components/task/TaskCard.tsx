import { useState } from "react";
import type { Task } from "@/types/task";
import { useTaskStore } from "@/stores/taskStore";
import { Button } from "@/components/ui/button";
import { Progress, ProgressValue } from "@/components/ui/progress";
import {
  ChevronDown,
  X,
  Check,
  AlertCircle,
  Ban,
  RefreshCw,
} from "lucide-react";

const statusConfig: Record<
  Task["status"],
  { label: string; color: string; icon: typeof Check; barColor: string }
> = {
  pending: { label: "等待中", color: "text-muted-foreground bg-muted/50", icon: RefreshCw, barColor: "bg-muted-foreground/30" },
  running: { label: "运行中", color: "text-foreground bg-foreground/10", icon: RefreshCw, barColor: "bg-primary" },
  completed: { label: "已完成", color: "text-green-600 dark:text-green-400 bg-green-500/10", icon: Check, barColor: "bg-green-500" },
  failed: { label: "失败", color: "text-red-600 dark:text-red-400 bg-red-500/10", icon: AlertCircle, barColor: "bg-red-500" },
  cancelled: { label: "已取消", color: "text-muted-foreground bg-muted/50", icon: Ban, barColor: "bg-muted-foreground/30" },
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function logLevelColor(level: Task["logs"][number]["level"]): string {
  switch (level) {
    case "error": return "text-red-500";
    case "warn": return "text-amber-500";
    default: return "text-muted-foreground";
  }
}

interface TaskCardProps {
  task: Task;
}

export function TaskCard({ task }: TaskCardProps) {
  const [expanded, setExpanded] = useState(false);
  const cancelTask = useTaskStore((s) => s.cancelTask);
  const removeTask = useTaskStore((s) => s.removeTask);
  const retryTask = useTaskStore((s) => s.retryTask);

  const sc = statusConfig[task.status];
  const isRunning = task.status === "running";
  const isPending = task.status === "pending";
  const isFinished = task.status === "completed" || task.status === "failed" || task.status === "cancelled";
  const canCancel = isRunning || isPending;
  const canRetry = task.status === "failed";
  const hasLogs = task.logs.length > 0;
  const progressPct =
    task.progress && task.progress.total > 0
      ? Math.round((task.progress.current / task.progress.total) * 100)
      : undefined;

  return (
    <div className="rounded-xl bg-muted/30 overflow-hidden">
      <div className="px-4 py-3">
        <div className="flex items-start gap-3">
          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${sc.color}`}>
                {sc.label}
              </span>
            </div>

            {task.description && (
              <p className="text-[12px] text-muted-foreground truncate mb-2">{task.description}</p>
            )}

            {/* Progress */}
            {(isRunning || isPending) && (
              <div className="mt-1">
                <Progress
                  value={progressPct ?? (isPending ? 0 : 0)}
                  className="gap-0"
                >
                  <ProgressValue className="text-[11px]" />
                </Progress>
                {task.progress?.stage && (
                  <p className="text-[11px] text-muted-foreground mt-1">{task.progress.stage}</p>
                )}
              </div>
            )}

            {isFinished && task.finishedAt && (
              <p className="text-[11px] text-muted-foreground/50 mt-1">
                {new Date(task.finishedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            {canCancel && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => cancelTask(task.id)}
                className="h-6 w-6 text-muted-foreground hover:text-destructive"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            )}
            {canRetry && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => retryTask(task.id)}
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
            )}
            {isFinished && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => removeTask(task.id)}
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            )}
            {hasLogs && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="p-1 rounded hover:bg-muted/50 transition-colors"
              >
                <ChevronDown
                  className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
                />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Expandable logs */}
      {expanded && hasLogs && (
        <div className="px-4 py-2 max-h-[200px] overflow-y-auto bg-black/[0.03] dark:bg-white/[0.03]">
          {task.logs.map((log, i) => (
            <div key={i} className="flex items-start gap-2 py-0.5 text-[11px] leading-tight font-mono">
              <span className="text-muted-foreground/50 shrink-0 tabular-nums">{formatTime(log.time)}</span>
              <span className={`shrink-0 ${logLevelColor(log.level)}`}>
                {log.level === "error" ? "ERR" : log.level === "warn" ? "WRN" : "INF"}
              </span>
              <span className="text-foreground/80 break-all">{log.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
