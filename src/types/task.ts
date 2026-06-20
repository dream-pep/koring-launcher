export type TaskType = "install" | "download" | "update" | "launch" | "auth" | "sync" | "custom";

export type TaskStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

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
}

export interface TaskContext {
  updateProgress: (progress: TaskProgress) => void;
  addLog: (level: TaskLog["level"], message: string) => void;
  abortSignal: AbortSignal;
}
