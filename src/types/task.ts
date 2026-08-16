//  __         __     __   __     ______     __  __     ______        __   __     ______     ______
// /\ \       /\ \   /\ "-.\ \   /\  ___\   /\ \/ /    /\  ___\      /\ "-.\ \   /\  ___\   /\__  _\
// \ \ \____  \ \ \  \ \ \-.  \  \ \ \__ \  \ \  _"-.  \ \  __\      \ \ \-.  \  \ \  __\   \/_/\ \/
//  \ \_____\  \ \_\  \ \_\\"\_\  \ \_____\  \ \_\ \_\  \ \_____\     \ \_\\"\_\  \ \_____\    \ \_\
//   \/_____/   \/_/   \/_/ \/_/   \/_____/   \/_/\/_/   \/_____/      \/_/ \/_/   \/_____/     \/_/
//
// 所有权利归Lingke Network (china)所有 | dream_pep拥有其艺术改变权力
// 未经允许的情况下删除此版权头可能会受到民事指控
// 请勿在未经Lingke Network (china)允许的范围内修改代码并分发

// 任务类型：install 安装 / download 下载 / update 更新 / launch 启动 / auth 认证 / sync 同步 / custom 自定义
export type TaskType = "install" | "download" | "update" | "launch" | "auth" | "sync" | "custom";

// 前端任务状态：包含 @xmcl/task 的 Paused 状态
export type TaskStatus = "pending" | "running" | "paused" | "completed" | "failed" | "cancelled";

// @xmcl/task 的 TaskState 枚举映射（Idle/Running/Cancelled/Paused/Succeed/Failed）
export type XmclTaskState = "idle" | "running" | "cancelled" | "paused" | "succeed" | "failed";

// 任务日志条目
export interface TaskLog {
  time: number;
  level: "info" | "warn" | "error";
  message: string;
}

// 任务进度
export interface TaskProgress {
  current: number;
  total: number;
  stage?: string;
}

// 任务实体
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
  /** @xmcl/task 原始状态（Idle/Running/Paused/Succeed/Failed/Cancelled） */
  xmclState?: XmclTaskState;
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
  xmclPath?: string;
}

export interface XmclTaskLogEvent {
  event: "task:log";
  taskId: string;
  level: "info" | "warn" | "error";
  message: string;
}

export interface XmclTaskPausedEvent {
  event: "task:paused";
  taskId: string;
}

export interface XmclTaskResumedEvent {
  event: "task:resumed";
  taskId: string;
}

export interface XmclTaskCancelledEvent {
  event: "task:cancelled";
  taskId: string;
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
  | XmclTaskPausedEvent
  | XmclTaskResumedEvent
  | XmclTaskCancelledEvent
  | XmclTaskCompletedEvent
  | XmclTaskFailedEvent;
