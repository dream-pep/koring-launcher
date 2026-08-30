import { create } from "zustand";
import {
  getKoringUser,
  logoutKoring,
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
}));
