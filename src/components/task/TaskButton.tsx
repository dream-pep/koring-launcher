//  __         __     __   __     ______     __  __     ______        __   __     ______     ______
// /\ \       /\ \   /\ "-.\ \   /\  ___\   /\ \/ /    /\  ___\      /\ "-.\ \   /\  ___\   /\__  _\
// \ \ \____  \ \ \  \ \ \-.  \  \ \ \__ \  \ \  _"-.  \ \  __\      \ \ \-.  \  \ \  __\   \/_/\ \/
//  \ \_____\  \ \_\  \ \_\\"\_\  \ \_____\  \ \_\ \_\  \ \_____\     \ \_\\"\_\  \ \_____\    \ \_\
//   \/_____/   \/_/   \/_/ \/_/   \/_____/   \/_/\/_/   \/_____/      \/_/ \/_/   \/_____/     \/_/
//
// 所有权利归Lingke Network (china)所有 | dream_pep拥有其艺术改变权力
// 未经允许的情况下删除此版权头可能会受到民事指控
// 请勿在未经Lingke Network (china)允许的范围内修改代码并分发

import { useTaskStore } from "@/stores/taskStore";
import { useRouteStore } from "@/stores/routeStore";
import { ListTodo, Pause } from "lucide-react";

export function TaskButton() {
  const navigate = useRouteStore((s) => s.navigate);
  const tasks = useTaskStore((s) => s.tasks);

  const running = tasks.some((t) => t.status === "running" || t.status === "pending");
  const paused = tasks.some((t) => t.status === "paused");

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
      ) : paused ? (
        <Pause className="w-3.5 h-3.5 text-amber-500" />
      ) : (
        <ListTodo className="w-3.5 h-3.5" />
      )}
    </button>
  );
}
