import { create } from "zustand";
import { launchGame, onGameEvent, diagnoseVersion } from "../api/launch";
import type { LaunchResult, LaunchServer } from "../api/launch";
import { useAuthStore } from "./authStore";

interface GameEvent {
  event: string;
  [key: string]: unknown;
}

interface LaunchState {
  /** 正在发起启动请求 */
  launching: boolean;
  /** 游戏进程正在运行 */
  running: boolean;
  gameResult: LaunchResult | null;
  events: GameEvent[];
  error: string | null;

  /**
   * 统一启动入口：指定实例 + 游戏根目录（可选快速联机）。
   * 账户档案从 authStore 自动获取；启动参数（Java/内存/GC/窗口等）由主进程读取权威配置自动应用。
   */
  launch: (instanceName: string, gamePath: string, server?: LaunchServer) => Promise<void>;
  diagnose: (gamePath: string, version: string) => Promise<void>;
  reset: () => void;
  clearError: () => void;
}

export const useLaunchStore = create<LaunchState>((set) => ({
  launching: false,
  running: false,
  gameResult: null,
  events: [],
  error: null,

  launch: async (instanceName: string, gamePath: string, server?: LaunchServer) => {
    const user = useAuthStore.getState().user;
    if (!user?.username || !user?.uuid) {
      set({ error: "请先在设置中登录账号", launching: false });
      return;
    }

    set({ launching: true, running: false, error: null, events: [], gameResult: null });
    try {
      const result = await launchGame({
        instanceName,
        gamePath,
        profile: {
          username: user.username,
          uuid: user.uuid,
          accessToken: user.accessToken || undefined,
        },
        server,
      });
      set({ gameResult: result, launching: false, running: true });

      // 订阅事件流（stdout / stderr / window-ready / exit）
      const unlisten = onGameEvent(result.requestId, (event) => {
        set((state) => ({ events: [...state.events, event] }));
        if (event.event === "exit") {
          set({ running: false });
          unlisten();
        }
      });
    } catch (e: any) {
      set({ error: e?.message || String(e), launching: false, running: false });
    }
  },

  diagnose: async (gamePath: string, version: string) => {
    try {
      await diagnoseVersion(gamePath, version);
    } catch (e: any) {
      set({ error: e.message });
    }
  },

  reset: () => {
    set({ launching: false, running: false, gameResult: null, events: [], error: null });
  },

  clearError: () => set({ error: null }),
}));
