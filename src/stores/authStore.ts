import { create } from "zustand";
import { offlineLogin, microsoftLoginStart, microsoftLoginCallback } from "../api/auth";
import type { AuthResult } from "../api/auth";
import { getAuth, saveAuth, deleteAuth } from "../api/auth-registry";

interface AuthState {
  user: AuthResult | null;
  loading: boolean;
  error: string | null;
  msAuthUrl: string | null;
  msAuthState: string | null;

  initFromRegistry: () => Promise<void>;
  loginOffline: (username: string) => Promise<void>;
  startMicrosoftLogin: (clientId: string) => Promise<void>;
  completeMicrosoftLogin: (code: string, clientId: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: false,
  error: null,
  msAuthUrl: null,
  msAuthState: null,

  initFromRegistry: async () => {
    try {
      const auth = await getAuth();
      if (auth.username && auth.uuid) {
        set({
          user: {
            username: auth.username,
            uuid: auth.uuid,
            accessToken: auth.accessToken,
            xboxProfile: auth.xboxProfile ? JSON.parse(auth.xboxProfile) : undefined,
          },
        });
      }
    } catch {
      // No auth saved yet
    }
  },

  loginOffline: async (username: string) => {
    set({ loading: true, error: null });
    try {
      const user = await offlineLogin(username);
      set({ user, loading: false });
      await saveAuth({
        username: user.username,
        uuid: user.uuid,
        accessToken: user.accessToken || "",
        refreshToken: "",
        xboxProfile: user.xboxProfile ? JSON.stringify(user.xboxProfile) : "",
      });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  startMicrosoftLogin: async (clientId: string) => {
    set({ loading: true, error: null });
    try {
      const { state, authUrl } = await microsoftLoginStart(clientId);
      set({ msAuthUrl: authUrl, msAuthState: state, loading: false });
      window.electronAPI?.openExternal(authUrl);
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  completeMicrosoftLogin: async (code: string, clientId: string) => {
    set({ loading: true, error: null });
    try {
      const user = await microsoftLoginCallback(code, clientId);
      set({ user, loading: false, msAuthUrl: null, msAuthState: null });
      await saveAuth({
        username: user.username,
        uuid: user.uuid,
        accessToken: user.accessToken || "",
        refreshToken: "",
        xboxProfile: user.xboxProfile ? JSON.stringify(user.xboxProfile) : "",
      });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  logout: async () => {
    set({ user: null, msAuthUrl: null, msAuthState: null });
    await deleteAuth().catch(() => {});
  },

  clearError: () => set({ error: null }),
}));
