import { create } from "zustand";
import {
  EMPTY_TERRACOTTA_STATUS,
  clearTerracottaBinary,
  fetchTerracottaLog,
  getTerracottaStatus,
  guestTerracotta,
  hostTerracotta,
  installTerracotta,
  onTerracottaInstallProgress,
  onTerracottaStatus,
  openTerracottaDir,
  pickTerracottaBinary,
  resetTerracotta,
  startTerracotta,
  stopTerracotta,
  type TerracottaStatus,
} from "@/api/terracotta";

/** 所有会发请求的动作（分别用于禁用按钮，互不阻塞） */
export type TcAction =
  | "refresh"
  | "install"
  | "start"
  | "stop"
  | "host"
  | "guest"
  | "reset"
  | "pick-binary"
  | "clear-binary"
  | "open-dir"
  | "fetch-log";

type TcPending = Record<TcAction, boolean>;

const EMPTY_PENDING: TcPending = {
  refresh: false,
  install: false,
  start: false,
  stop: false,
  host: false,
  guest: false,
  reset: false,
  "pick-binary": false,
  "clear-binary": false,
  "open-dir": false,
  "fetch-log": false,
};

/** 把底层异常转成面向用户的中文提示（主进程通常已给出中文 error） */
export function toReadableError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const trimmed = message.trim();
  if (!trimmed) return "操作失败，请稍后重试";
  if (/^request failed$/i.test(trimmed)) return "操作失败：主进程未返回具体原因";
  if (/timed?\s*out|timeout/i.test(trimmed)) return "操作超时，请检查网络后重试";
  if (/not installed/i.test(trimmed)) return "陶瓦联机尚未安装，请先下载并安装";
  if (/not running/i.test(trimmed)) return "陶瓦联机服务未运行，请先启动服务";
  return trimmed;
}

interface TerracottaState {
  status: TerracottaStatus;
  /** 是否已成功拉取过一次真实状态（区分「尚未加载」与「未安装」） */
  loaded: boolean;
  pending: TcPending;
  /** 最近一次操作的错误（中文） */
  error: string;
  /** terracotta:fetch-log 取回的日志 */
  log: string;

  /**
   * 订阅主进程状态事件并拉取一次状态。
   * 返回取消订阅函数，供页面 useEffect 清理。
   */
  init: () => () => void;
  refresh: () => Promise<void>;
  install: (force?: boolean) => Promise<void>;
  start: (player?: string) => Promise<void>;
  stop: () => Promise<void>;
  host: (player?: string, publicNodes?: string[]) => Promise<void>;
  guest: (room: string, player?: string, publicNodes?: string[]) => Promise<void>;
  reset: () => Promise<void>;
  /** 返回选中的路径；取消/失败返回 null（错误同时写入 error） */
  pickBinary: () => Promise<string | null>;
  clearBinary: () => Promise<void>;
  openDir: () => Promise<string | null>;
  fetchLog: () => Promise<string | null>;
  clearError: () => void;
  clearLog: () => void;
}

export const useTerracottaStore = create<TerracottaState>((set, get) => {
  /** 统一执行一个动作：置 pending、清错误、应用返回的最新状态、捕获可读错误 */
  const run = async (action: TcAction, task: () => Promise<TerracottaStatus | null | undefined>) => {
    set((state) => ({ pending: { ...state.pending, [action]: true }, error: "" }));
    try {
      const next = await task();
      if (next && next.snapshot) {
        set({ status: next, loaded: true });
      } else {
        // 部分契约通道只返回局部字段，动作内部自行处理，这里补一次状态刷新
        await get().refresh();
      }
    } catch (error) {
      set({ error: toReadableError(error) });
    } finally {
      set((state) => ({ pending: { ...state.pending, [action]: false } }));
    }
  };

  return {
    status: EMPTY_TERRACOTTA_STATUS,
    loaded: false,
    pending: EMPTY_PENDING,
    error: "",
    log: "",

    init: () => {
      const unsubscribeStatus = onTerracottaStatus((status) => {
        if (!status || !status.snapshot) return;
        set({ status, loaded: true });
      });
      const unsubscribeProgress = onTerracottaInstallProgress((progress) => {
        if (!progress) return;
        set((state) => ({ status: { ...state.status, install: progress } }));
        // 安装完成后再拉一次状态，确保 binary.installed 及时生效（即便主进程未广播）
        if (progress.stage === "done") void get().refresh();
      });
      void get().refresh();
      return () => {
        unsubscribeStatus();
        unsubscribeProgress();
      };
    },

    refresh: async () => {
      set((state) => ({ pending: { ...state.pending, refresh: true } }));
      try {
        const status = await getTerracottaStatus();
        if (status?.snapshot) set({ status, loaded: true });
      } catch (error) {
        set({ error: toReadableError(error), loaded: true });
      } finally {
        set((state) => ({ pending: { ...state.pending, refresh: false } }));
      }
    },

    install: async (force = false) => run("install", () => installTerracotta(force)),

    start: async (player) => run("start", () => startTerracotta(player)),

    stop: async () => run("stop", () => stopTerracotta()),

    host: async (player, publicNodes) => run("host", () => hostTerracotta(player, publicNodes)),

    guest: async (room, player, publicNodes) =>
      run("guest", () => guestTerracotta(room, player, publicNodes)),

    reset: async () => run("reset", () => resetTerracotta()),

    pickBinary: async () => {
      set((state) => ({ pending: { ...state.pending, "pick-binary": true }, error: "" }));
      try {
        const path = await pickTerracottaBinary();
        // 主进程会持久化 binaryPath 并广播状态；再刷新一次确保 binary 信息最新
        await get().refresh();
        return path || null;
      } catch (error) {
        set({ error: toReadableError(error) });
        return null;
      } finally {
        set((state) => ({ pending: { ...state.pending, "pick-binary": false } }));
      }
    },

    clearBinary: async () => run("clear-binary", () => clearTerracottaBinary()),

    openDir: async () => {
      set((state) => ({ pending: { ...state.pending, "open-dir": true }, error: "" }));
      try {
        const path = await openTerracottaDir();
        return path || null;
      } catch (error) {
        set({ error: toReadableError(error) });
        return null;
      } finally {
        set((state) => ({ pending: { ...state.pending, "open-dir": false } }));
      }
    },

    fetchLog: async () => {
      set((state) => ({ pending: { ...state.pending, "fetch-log": true }, error: "" }));
      try {
        const content = await fetchTerracottaLog();
        set({ log: content });
        return content;
      } catch (error) {
        set({ error: toReadableError(error) });
        return null;
      } finally {
        set((state) => ({ pending: { ...state.pending, "fetch-log": false } }));
      }
    },

    clearError: () => set({ error: "" }),
    clearLog: () => set({ log: "" }),
  };
});
