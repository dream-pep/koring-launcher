import { create } from "zustand";
import {
  checkForUpdates,
  downloadUpdate,
  getUpdateState,
  onUpdateStatus,
  quitAndInstall,
  resumeUpdate,
  type UpdateStatusPayload,
} from "../api/update";

/**
 * 更新 store（与主进程 electron/updater.ts 的状态机联动）：
 * - 模块加载即订阅 update:status 事件 + 拉取一次状态快照
 * - check() / install() 触发主进程操作，状态由事件驱动更新
 */

interface UpdateProgress {
  percent: number;
  transferred: number;
  total: number;
  bytesPerSecond: number;
}

interface UpdateStoreState {
  checking: boolean;
  downloading: boolean;
  installed: boolean;
  progress: UpdateProgress | null;
  update: { version: string; releaseNotes?: string } | null;
  currentVersion: string;
  source: string;
  error: string | null;
  check: () => Promise<void>;
  install: () => Promise<void>;
  reset: () => void;
}

type Setter = (partial: Partial<UpdateStoreState>) => void;

function applyStatus(set: Setter, status: UpdateStatusPayload): void {
  const next: Partial<UpdateStoreState> = {
    currentVersion: status.currentVersion ?? "",
    source: status.source ?? "github",
  };

  switch (status.state) {
    case "checking":
      next.checking = true;
      next.error = null;
      break;
    case "available":
      next.checking = false;
      next.update = { version: status.version ?? "", releaseNotes: undefined };
      next.error = null;
      break;
    case "not-available":
      next.checking = false;
      next.update = null;
      next.error = null;
      break;
    case "downloading":
      next.downloading = true;
      next.progress = {
        percent: status.percent ?? 0,
        transferred: status.transferred ?? 0,
        total: status.total ?? 0,
        bytesPerSecond: status.bytesPerSecond ?? 0,
      };
      next.error = null;
      break;
    case "paused":
      // 下载已暂停：保持 downloading 标记（VersionCard 按钮点击即继续）
      next.downloading = true;
      next.progress = {
        percent: status.percent ?? 0,
        transferred: status.transferred ?? 0,
        total: status.total ?? 0,
        bytesPerSecond: 0,
      };
      next.error = null;
      break;
    case "downloaded":
    case "installing":
      next.downloading = false;
      next.installed = true;
      next.update = { version: status.version ?? "", releaseNotes: undefined };
      next.error = null;
      break;
    case "error":
      next.checking = false;
      next.downloading = false;
      next.error = status.error ?? "更新失败";
      break;
    default:
      break;
  }

  set(next);
}

export const useUpdateStore = create<UpdateStoreState>((set, get) => {
  // 模块加载即订阅（VersionCard 等组件引入本 store 后生效）
  onUpdateStatus((status) => applyStatus(set, status));
  getUpdateState()
    .then((status) => applyStatus(set, status))
    .catch((e) => console.error("[update] 获取状态失败:", e));

  return {
    checking: false,
    downloading: false,
    installed: false,
    progress: null,
    update: null,
    currentVersion: "",
    source: "github",
    error: null,

    check: async () => {
      set({ checking: true, error: null });
      try {
        await checkForUpdates(true);
      } catch (e) {
        set({ error: e instanceof Error ? e.message : String(e), checking: false });
      }
    },

    install: async () => {
      set({ downloading: true, error: null, progress: null });
      try {
        // 智能分派：暂停→继续；已下载→安装；否则→开始下载
        const state = get().installed ? "downloaded" : get().update ? "available" : "idle";
        if (state === "downloaded") {
          await quitAndInstall();
          return;
        }
        if (get().downloading && get().progress) {
          await resumeUpdate();
          return;
        }
        await downloadUpdate();
      } catch (e) {
        set({ error: e instanceof Error ? e.message : String(e), downloading: false });
      }
    },

    reset: () =>
      set({
        update: null,
        error: null,
        progress: null,
        installed: false,
        checking: false,
        downloading: false,
      }),
  };
});
