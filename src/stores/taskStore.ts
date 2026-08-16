import { create } from "zustand";
import { onIpcEvent, ipcInvoke } from "@/api/ipc";
import { isDev } from "@/lib/mode";
import type {
  Task,
  TaskType,
  TaskProgress,
  TaskLog,
  TaskContext,
  TaskExecutor,
  XmclTaskDef,
  XmclTaskEvent,
} from "@/types/task";

const STORAGE_KEY = "koring-task-history";
const MAX_HISTORY = 50;

function generateId(): string {
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadHistory(): Task[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_HISTORY) : [];
  } catch {
    return [];
  }
}

function saveHistory(tasks: Task[]) {
  try {
    const completed = tasks
      .filter((t) => t.status === "completed" || t.status === "failed" || t.status === "cancelled")
      .slice(0, MAX_HISTORY);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(completed));
  } catch {
    /* ignore quota errors */
  }
}

// Sidecar event listener cache
const eventListeners = new Map<string, () => void>();

function updateTask(taskId: string, patch: Partial<Task>) {
  useTaskStore.setState((state) => ({
    tasks: state.tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t)),
  }));
}

function listenToSidecarEvents(taskId: string) {
  const unlisten = onIpcEvent<{ taskId: string; event: string; [key: string]: unknown }>(
    "task:progress",
    (data) => {
      if (data.taskId !== taskId) return;

      switch (data.event) {
        case "task:started":
          updateTask(taskId, {
            status: "running",
            startedAt: Date.now(),
            xmclPath: data.xmclPath as string,
            xmclState: "running",
          });
          break;

        case "task:progress":
          updateTask(taskId, {
            progress: {
              current: data.current as number,
              total: data.total as number,
              stage: data.stage as string,
            },
            xmclPath: (data.xmclPath as string) || undefined,
          });
          break;

        case "task:log": {
          const log: TaskLog = { time: Date.now(), level: data.level as "info" | "warn" | "error", message: data.message as string };
          const current = useTaskStore.getState().tasks.find((t) => t.id === taskId);
          if (current) {
            updateTask(taskId, { logs: [...current.logs, log] });
          }
          break;
        }

        case "task:paused":
          updateTask(taskId, {
            status: "paused",
            xmclState: "paused",
          });
          break;

        case "task:resumed":
          updateTask(taskId, {
            status: "running",
            xmclState: "running",
          });
          break;

        case "task:cancelled":
          updateTask(taskId, {
            status: "cancelled",
            xmclState: "cancelled",
            finishedAt: Date.now(),
          });
          eventListeners.get(taskId)?.();
          eventListeners.delete(taskId);
          setTimeout(() => {
            const state = useTaskStore.getState();
            saveHistory(state.tasks);
          }, 0);
          break;

        case "task:completed":
          updateTask(taskId, {
            status: "completed",
            xmclState: "succeed",
            finishedAt: Date.now(),
          });
          eventListeners.get(taskId)?.();
          eventListeners.delete(taskId);
          setTimeout(() => {
            const state = useTaskStore.getState();
            saveHistory(state.tasks);
          }, 0);
          break;

        case "task:failed": {
          const errLog: TaskLog = { time: Date.now(), level: "error", message: data.error as string };
          const cur = useTaskStore.getState().tasks.find((t) => t.id === taskId);
          updateTask(taskId, {
            status: "failed",
            xmclState: "failed",
            finishedAt: Date.now(),
            logs: cur ? [...cur.logs, errLog] : [errLog],
          });
          eventListeners.get(taskId)?.();
          eventListeners.delete(taskId);
          setTimeout(() => {
            const state = useTaskStore.getState();
            saveHistory(state.tasks);
          }, 0);
          break;
        }
      }
    }
  );

  eventListeners.set(taskId, unlisten);
}

interface TaskState {
  tasks: Task[];
  localExecutors: Map<string, TaskExecutor>;
  abortControllers: Map<string, AbortController>;

  // Derived
  isRunning: () => boolean;
  activeTasks: () => Task[];
  completedTasks: () => Task[];
  pendingCount: () => number;
  runningCount: () => number;

  // Local task actions (runs executor in browser)
  addTask: (type: TaskType, title: string, description: string | undefined, executor: TaskExecutor) => string;

  // IPC task actions (runs @xmcl/task in main process)
  addSidecarTask: (def: XmclTaskDef) => string;

  // Common actions
  cancelTask: (id: string) => void;
  // @xmcl/task 原生暂停 / 恢复
  pauseTask: (id: string) => void;
  resumeTask: (id: string) => void;
  removeTask: (id: string) => void;
  clearHistory: () => void;
  retryTask: (id: string) => void;
  _startLocalTask: (id: string) => void;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: loadHistory(),
  localExecutors: new Map(),
  abortControllers: new Map(),

  isRunning: () => get().tasks.some((t) => t.status === "running" || t.status === "pending"),
  activeTasks: () => get().tasks.filter((t) => t.status === "running" || t.status === "pending"),
  completedTasks: () => get().tasks.filter((t) => t.status === "completed" || t.status === "failed" || t.status === "cancelled"),
  pendingCount: () => get().tasks.filter((t) => t.status === "pending").length,
  runningCount: () => get().tasks.filter((t) => t.status === "running").length,

  addTask: (type, title, description, executor) => {
    const id = generateId();
    const newTask: Task = {
      id,
      type,
      title,
      description,
      status: "pending",
      logs: [],
      createdAt: Date.now(),
    };

    set((state) => {
      const tasks = [...state.tasks, newTask];
      const localExecutors = new Map(state.localExecutors);
      localExecutors.set(id, executor);
      return { tasks, localExecutors };
    });

    get()._startLocalTask(id);
    return id;
  },

  addSidecarTask: (def) => {
    const id = generateId();
    const newTask: Task = {
      id,
      type: def.type,
      title: def.title,
      description: def.description,
      status: "pending",
      logs: [],
      createdAt: Date.now(),
    };

    set((state) => ({
      tasks: [...state.tasks, newTask],
    }));

    // In dev mode, main process is not running — fall back to local simulation
    if (isDev) {
      const executor: TaskExecutor = async (ctx) => {
        ctx.addLog("info", `[Dev Fallback] 模拟 @xmcl/task 执行器: ${def.executorName}`);
        const steps = 20;
        for (let i = 0; i <= steps; i++) {
          if (ctx.abortSignal.aborted) throw new Error("已取消");
          ctx.updateProgress({ current: i, total: steps, stage: `步骤 ${i}/${steps}` });
          ctx.addLog("info", `进度 ${Math.round((i / steps) * 100)}%`);
          await new Promise((r) => setTimeout(r, 150));
        }
        ctx.addLog("info", "任务完成（Dev 模拟）");
      };

      const localExecutors = new Map(get().localExecutors);
      localExecutors.set(id, executor);
      set({ localExecutors });
      get()._startLocalTask(id);
      return id;
    }

    // Listen for main process events
    listenToSidecarEvents(id);

    // Send start command to main process
    ipcInvoke("task:start", {
      taskId: id,
      type: def.type,
      title: def.title,
      description: def.description,
      executorName: def.executorName,
      params: def.params,
    }).catch((err) => {
      // If main process fails to start, mark as failed
      set((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === id
            ? {
                ...t,
                status: "failed" as const,
                finishedAt: Date.now(),
                logs: [...t.logs, { time: Date.now(), level: "error" as const, message: String(err) }],
              }
            : t,
        ),
      }));
      eventListeners.get(id)?.();
      eventListeners.delete(id);
    });

    return id;
  },

  cancelTask: (id) => {
    const { abortControllers, tasks } = get();
    const task = tasks.find((t) => t.id === id);

    // Cancel local task
    const controller = abortControllers.get(id);
    if (controller) {
      controller.abort();
    }

    // Cancel IPC task
    if (task && !controller) {
      ipcInvoke("task:cancel", { taskId: id }).catch(() => {});
    }

    set((state) => {
      const tasks = state.tasks.map((t) =>
        t.id === id && (t.status === "pending" || t.status === "running")
          ? { ...t, status: "cancelled" as const, finishedAt: Date.now() }
          : t,
      );
      const abortControllers = new Map(state.abortControllers);
      abortControllers.delete(id);
      saveHistory(tasks);
      return { tasks, abortControllers };
    });

    eventListeners.get(id)?.();
    eventListeners.delete(id);
  },

  // 暂停任务：主进程调用 @xmcl/task 的 pause()
  pauseTask: (id) => {
    const { tasks } = get();
    const task = tasks.find((t) => t.id === id);
    // 仅允许暂停运行中的 IPC 任务（本地任务不支持暂停）
    if (task && task.status === "running" && !get().abortControllers.has(id)) {
      ipcInvoke("task:pause", { taskId: id }).catch(() => {});
    }
  },

  // 恢复任务：主进程调用 @xmcl/task 的 resume()
  resumeTask: (id) => {
    const { tasks } = get();
    const task = tasks.find((t) => t.id === id);
    if (task && task.status === "paused") {
      ipcInvoke("task:resume", { taskId: id }).catch(() => {});
    }
  },

  removeTask: (id) => {
    eventListeners.get(id)?.();
    eventListeners.delete(id);

    set((state) => {
      const tasks = state.tasks.filter((t) => t.id !== id);
      const localExecutors = new Map(state.localExecutors);
      localExecutors.delete(id);
      saveHistory(tasks);
      return { tasks, localExecutors };
    });
  },

  clearHistory: () => {
    set((state) => {
      const tasks = state.tasks.filter((t) => t.status === "running" || t.status === "pending");
      saveHistory(tasks);
      return { tasks };
    });
  },

  retryTask: (id) => {
    const { tasks, localExecutors } = get();
    const original = tasks.find((t) => t.id === id);
    const executor = localExecutors.get(id);
    if (!original) return;

    if (executor) {
      // Retry local task
      const newId = generateId();
      const newTask: Task = {
        ...original,
        id: newId,
        status: "pending",
        progress: undefined,
        logs: [],
        createdAt: Date.now(),
        startedAt: undefined,
        finishedAt: undefined,
      };

      set((state) => {
        const tasks = [...state.tasks, newTask];
        const localExecutors = new Map(state.localExecutors);
        localExecutors.set(newId, executor);
        return { tasks, localExecutors };
      });

      get()._startLocalTask(newId);
    } else {
      // Retry IPC task (re-add with same params)
      const newId = generateId();
      const newTask: Task = {
        ...original,
        id: newId,
        status: "pending",
        progress: undefined,
        logs: [],
        createdAt: Date.now(),
        startedAt: undefined,
        finishedAt: undefined,
      };

      set((state) => ({
        tasks: [...state.tasks, newTask],
      }));

      listenToSidecarEvents(newId);

      ipcInvoke("task:start", {
        taskId: newId,
        type: original.type,
        title: original.title,
        description: original.description,
        executorName: "sleep",
        params: {},
      }).catch((err) => {
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === newId
              ? {
                  ...t,
                  status: "failed" as const,
                  finishedAt: Date.now(),
                  logs: [...t.logs, { time: Date.now(), level: "error" as const, message: String(err) }],
                }
              : t,
          ),
        }));
      });
    }
  },

  _startLocalTask: (id: string) => {
    const { tasks, localExecutors } = get();
    const task = tasks.find((t) => t.id === id);
    const executor = localExecutors.get(id);
    if (!task || task.status !== "pending" || !executor) return;

    const controller = new AbortController();
    set((state) => {
      const abortControllers = new Map(state.abortControllers);
      abortControllers.set(id, controller);
      const tasks = state.tasks.map((t) =>
        t.id === id
          ? { ...t, status: "running" as const, startedAt: Date.now() }
          : t,
      );
      return { tasks, abortControllers };
    });

    const ctx: TaskContext = {
      updateProgress: (progress: TaskProgress) => {
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id ? { ...t, progress } : t,
          ),
        }));
      },
      addLog: (level: TaskLog["level"], message: string) => {
        const log: TaskLog = { time: Date.now(), level, message };
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id ? { ...t, logs: [...t.logs, log] } : t,
          ),
        }));
      },
      abortSignal: controller.signal,
    };

    executor(ctx)
      .then(() => {
        if (controller.signal.aborted) return;
        set((state) => {
          const tasks = state.tasks.map((t) =>
            t.id === id
              ? { ...t, status: "completed" as const, finishedAt: Date.now() }
              : t,
          );
          saveHistory(tasks);
          return { tasks };
        });
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : String(err);
        set((state) => {
          const tasks = state.tasks.map((t) =>
            t.id === id
              ? {
                  ...t,
                  status: "failed" as const,
                  finishedAt: Date.now(),
                  logs: [...t.logs, { time: Date.now(), level: "error" as const, message }],
                }
              : t,
          );
          saveHistory(tasks);
          return { tasks };
        });
      })
      .finally(() => {
        const { abortControllers } = get();
        const next = new Map(abortControllers);
        next.delete(id);
        set({ abortControllers: next });
      });
  },
}));
