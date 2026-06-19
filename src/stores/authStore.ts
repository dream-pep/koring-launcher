import { create } from "zustand";
import { offlineLogin, microsoftLoginStart, microsoftLoginCallback } from "../api/auth";
import type { AuthResult } from "../api/auth";

interface AuthState {
  user: AuthResult | null;
  loading: boolean;
  error: string | null;
  msAuthUrl: string | null;
  msAuthState: string | null;

  loginOffline: (username: string) => Promise<void>;
  startMicrosoftLogin: (clientId: string) => Promise<void>;
  completeMicrosoftLogin: (code: string, clientId: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: false,
  error: null,
  msAuthUrl: null,
  msAuthState: null,

  loginOffline: async (username: string) => {
    set({ loading: true, error: null });
    try {
      const user = await offlineLogin(username);
      set({ user, loading: false });
      localStorage.setItem("koring-user", JSON.stringify(user));
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  startMicrosoftLogin: async (clientId: string) => {
    set({ loading: true, error: null });
    try {
      const { state, authUrl } = await microsoftLoginStart(clientId);
      set({ msAuthUrl: authUrl, msAuthState: state, loading: false });
      window.open(authUrl, "_blank");
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  completeMicrosoftLogin: async (code: string, clientId: string) => {
    set({ loading: true, error: null });
    try {
      const user = await microsoftLoginCallback(code, clientId);
      set({ user, loading: false, msAuthUrl: null, msAuthState: null });
      localStorage.setItem("koring-user", JSON.stringify(user));
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  logout: () => {
    set({ user: null, msAuthUrl: null, msAuthState: null });
    localStorage.removeItem("koring-user");
  },

  clearError: () => set({ error: null }),
}));
