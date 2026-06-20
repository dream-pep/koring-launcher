import { create } from "zustand";
import type { Task, TaskType, TaskProgress, TaskLog, TaskContext } from "@/types/task";

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

interface TaskExecutor {
  (ctx: TaskContext): Promise<void>;
}

interface TaskState {
  tasks: Task[];
  executors: Map<string, TaskExecutor>;
  abortControllers: Map<string, AbortController>;

  // Derived
  isRunning: () => boolean;
  activeTasks: () => Task[];
  completedTasks: () => Task[];
  pendingCount: () => number;
  runningCount: () => number;

  // Actions
  addTask: (type: TaskType, title: string, description: string | undefined, executor: TaskExecutor) => string;
  cancelTask: (id: string) => void;
  removeTask: (id: string) => void;
  clearHistory: () => void;
  retryTask: (id: string) => void;
  _startTask: (id: string) => void;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: loadHistory(),
  executors: new Map(),
  abortControllers: new Map(),

  isRunning: () => get().tasks.some((t) => t.status === "running" || t.status === "pending"),
  activeTasks: () => get().tasks.filter((t) => t.status === "running" || t.status === "pending"),
  completedTasks: () => get().tasks.filter((t) => t.status === "completed" || t.status === "failed" || t.status === "cancelled"),
  pendingCount: () => get().tasks.filter((t) => t.status === "pending").length,
  runningCount: () => get().tasks.filter((t) => t.status === "running").length,

  addTask: (type, title, description, executor) => {
    const id = generateId();
    const task: Task = {
      id,
      type,
      title,
      description,
      status: "pending",
      logs: [],
      createdAt: Date.now(),
    };

    set((state) => {
      const tasks = [...state.tasks, task];
      const executors = new Map(state.executors);
      executors.set(id, executor);
      return { tasks, executors };
    });

    // Auto-start
    get()._startTask(id);
    return id;
  },

  cancelTask: (id) => {
    const { abortControllers } = get();
    const controller = abortControllers.get(id);
    if (controller) {
      controller.abort();
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
  },

  removeTask: (id) => {
    set((state) => {
      const tasks = state.tasks.filter((t) => t.id !== id);
      const executors = new Map(state.executors);
      executors.delete(id);
      saveHistory(tasks);
      return { tasks, executors };
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
    const { tasks, executors } = get();
    const original = tasks.find((t) => t.id === id);
    const executor = executors.get(id);
    if (!original || !executor) return;

    const newTask: Task = {
      ...original,
      id: generateId(),
      status: "pending",
      progress: undefined,
      logs: [],
      createdAt: Date.now(),
      startedAt: undefined,
      finishedAt: undefined,
    };

    set((state) => {
      const tasks = [...state.tasks, newTask];
      const executors = new Map(state.executors);
      executors.set(newTask.id, executor);
      return { tasks, executors };
    });

    get()._startTask(newTask.id);
  },

  _startTask: (id: string) => {
    const { tasks, executors } = get();
    const task = tasks.find((t) => t.id === id);
    const executor = executors.get(id);
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
