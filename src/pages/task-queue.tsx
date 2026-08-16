import { useTaskStore } from "@/stores/taskStore";
import { TaskCard } from "@/components/task/TaskCard";
import { Button } from "@/components/ui/button";
import { Trash2, Inbox } from "lucide-react";

export function TaskQueue() {
  const tasks = useTaskStore((s) => s.tasks);
  const clearHistory = useTaskStore((s) => s.clearHistory);

  const activeTasks = tasks.filter(
    (t) => t.status === "pending" || t.status === "running",
  );
  const pausedTasks = tasks.filter((t) => t.status === "paused");
  const completedTasks = tasks.filter(
    (t) =>
      t.status === "completed" ||
      t.status === "failed" ||
      t.status === "cancelled",
  );
  const hasCompleted = completedTasks.length > 0;
  const activeCount = activeTasks.length + pausedTasks.length;

  return (
    <div className="h-full overflow-y-auto px-6 py-5">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-foreground">
              任务队列
            </h1>
            {activeCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium tabular-nums">
                {activeCount} 进行中
              </span>
            )}
          </div>

          {hasCompleted && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearHistory}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              清空历史
            </Button>
          )}
        </div>

        {/* Task list */}
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
            <Inbox className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">暂无任务</p>
          </div>
        ) : (
          <div className="space-y-5">
            {activeTasks.length > 0 && (
              <div>
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-foreground/30 mb-2.5">
                  进行中
                </h3>
                <div className="space-y-2.5">
                  {activeTasks.map((t) => (
                    <TaskCard key={t.id} task={t} />
                  ))}
                </div>
              </div>
            )}

            {pausedTasks.length > 0 && (
              <div>
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-amber-500/70 mb-2.5">
                  已暂停
                </h3>
                <div className="space-y-2.5">
                  {pausedTasks.map((t) => (
                    <TaskCard key={t.id} task={t} />
                  ))}
                </div>
              </div>
            )}

            {completedTasks.length > 0 && (
              <div>
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-foreground/30 mb-2.5">
                  已完成
                </h3>
                <div className="space-y-2.5">
                  {completedTasks.map((t) => (
                    <TaskCard key={t.id} task={t} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
