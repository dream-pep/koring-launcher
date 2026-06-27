import { useTaskStore } from "@/stores/taskStore";
import { useRouteStore } from "@/stores/routeStore";
import { ListTodo } from "lucide-react";

export function TaskButton() {
  const navigate = useRouteStore((s) => s.navigate);
  const isRunning = useTaskStore((s) => s.isRunning);

  const running = isRunning();

  return (
    <button
      type="button"
      onClick={() => navigate("task-queue")}
      className="flex items-center justify-center w-[25px] h-[25px] rounded transition-colors cursor-default hover:bg-black/10 dark:hover:bg-white/15 text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white"
      style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
    >
      {running ? (
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
    </button>
  );
}
