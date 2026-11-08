import { create } from "zustand";
import {
  getKoringUser,
  logoutKoring,
  validateKoringAuth,
  type KoringAuthValidation,
  type KoringUser,
  type KoringAuthData,
} from "../api/koring-auth";

interface KoringAuthState {
  user: KoringUser | null;
  authData: KoringAuthData | null;
  loading: boolean;

  initFromDisk: () => Promise<void>;
  setUser: (user: KoringUser) => void;
  logout: () => Promise<void>;
  /** 校验登录是否仍有效：有效时顺带刷新用户信息，过期时清空本地用户 */
  validate: () => Promise<KoringAuthValidation>;
}

export const useKoringAuthStore = create<KoringAuthState>((set, get) => ({
  user: null,
  authData: null,
  loading: false,

  initFromDisk: async () => {
    // 如果已经有用户数据，跳过重复读取
    if (get().user) return;
    set({ loading: true });
    try {
      const data = await getKoringUser();
      if (data?.user?.sub) {
        set({ user: data.user, authData: data, loading: false });
      } else {
        set({ loading: false });
      }
    } catch {
      set({ loading: false });
    }
  },

  setUser: (user) => set({ user }),

  logout: async () => {
    set({ user: null, authData: null });
    await logoutKoring().catch(() => {});
  },

  validate: async () => {
    let result: KoringAuthValidation;
    try {
      result = await validateKoringAuth();
    } catch (error) {
      return {
        status: "error",
        message: error instanceof Error ? error.message : String(error),
      };
    }
    if (result.status === "expired") {
      // 会话确实失效：清掉本地用户，页面会回到「需要登录」提示
      set({ user: null, authData: null });
      await logoutKoring().catch(() => {});
    } else if (result.status === "ok" && result.user) {
      set({ user: result.user });
    }
    return result;
  },
}));
