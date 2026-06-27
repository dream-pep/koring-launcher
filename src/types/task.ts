export type TaskType = "install" | "download" | "update" | "launch" | "auth" | "sync" | "custom";

export type TaskStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

/** Mirrors @xmcl/task TaskState enum */
export type XmclTaskState = "idle" | "running" | "cancelled" | "paused" | "succeed" | "failed";

export interface TaskLog {
  time: number;
  level: "info" | "warn" | "error";
  message: string;
}

export interface TaskProgress {
  current: number;
  total: number;
  stage?: string;
}

export interface Task {
  id: string;
  type: TaskType;
  title: string;
  description?: string;
  status: TaskStatus;
  progress?: TaskProgress;
  logs: TaskLog[];
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  /** Sidecar @xmcl/task routine name (dot-separated path) */
  xmclPath?: string;
}

/**
 * Frontend task executor — runs in browser.
 * For IPC tasks, this is a no-op placeholder; real work runs in main process via @xmcl/task.
 * For local tasks (debug/mock), this runs directly in browser.
 */
export interface TaskExecutor {
  (ctx: TaskContext): Promise<void>;
}

/** Frontend-side task context (for local/mock tasks only) */
export interface TaskContext {
  updateProgress: (progress: TaskProgress) => void;
  addLog: (level: TaskLog["level"], message: string) => void;
  abortSignal: AbortSignal;
}

// === Sidecar @xmcl/task bridge types ===

/** Task definition sent to main process for @xmcl/task execution */
export interface XmclTaskDef {
  type: TaskType;
  title: string;
  description?: string;
  /** @xmcl/task executor name — must match a registered executor in main process */
  executorName: string;
  /** Params passed to the @xmcl/task executor */
  params?: Record<string, unknown>;
}

/** Events emitted by main process @xmcl/task execution */
export interface XmclTaskStartedEvent {
  event: "task:started";
  taskId: string;
  xmclPath: string;
}

export interface XmclTaskProgressEvent {
  event: "task:progress";
  taskId: string;
  current: number;
  total: number;
  stage?: string;
}

export interface XmclTaskLogEvent {
  event: "task:log";
  taskId: string;
  level: "info" | "warn" | "error";
  message: string;
}

export interface XmclTaskCompletedEvent {
  event: "task:completed";
  taskId: string;
}

export interface XmclTaskFailedEvent {
  event: "task:failed";
  taskId: string;
  error: string;
}

export type XmclTaskEvent =
  | XmclTaskStartedEvent
  | XmclTaskProgressEvent
  | XmclTaskLogEvent
  | XmclTaskCompletedEvent
  | XmclTaskFailedEvent;
