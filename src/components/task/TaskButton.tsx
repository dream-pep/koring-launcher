import { useTaskStore } from "@/stores/taskStore";
import { useRouteStore } from "@/stores/routeStore";
import { ListTodo } from "lucide-react";

export function TaskButton() {
  const navigate = useRouteStore((s) => s.navigate);
  const isRunning = useTaskStore((s) => s.isRunning);
  const activeTasks = useTaskStore((s) => s.activeTasks);
  const completedTasks = useTaskStore((s) => s.completedTasks);
  const tasks = useTaskStore((s) => s.tasks);

  const running = isRunning();
  const active = activeTasks();
  const completed = completedTasks();
  const hasAny = tasks.length > 0;

  if (!hasAny) return null;

  const badgeCount = running ? active.length : completed.length;

  return (
    <button
      onClick={() => navigate("task-queue")}
      className="flex items-center justify-center w-[25px] h-[25px] rounded transition-colors cursor-default hover:bg-black/10 dark:hover:bg-white/15 text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white relative"
      data-no-drag
    >
      {running ? (
        /* Circular progress indicator */
        <svg className="w-4 h-4" viewBox="0 0 16 16">
          <circle
            cx="8"
            cy="8"
            r="6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray="37.7"
            strokeDashoffset="9.4"
            strokeLinecap="round"
            className="animate-spin origin-center"
            style={{ animationDuration: "1.2s" }}
          />
        </svg>
      ) : (
        <ListTodo className="w-3.5 h-3.5" />
      )}
      {badgeCount > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[9px] font-bold px-1 tabular-nums">
          {badgeCount}
        </span>
      )}
    </button>
  );
}
