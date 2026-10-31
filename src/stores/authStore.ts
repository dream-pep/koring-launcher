//  __         __     __   __     ______     __  __     ______        __   __     ______     ______
// /\ \       /\ \   /\ "-.\ \   /\  ___\   /\ \/ /    /\  ___\      /\ "-.\ \   /\  ___\   /\__  _\
// \ \ \____  \ \ \  \ \ \-.  \  \ \ \__ \  \ \  _"-.  \ \  __\      \ \ \-.  \  \ \  __\   \/_/\ \/
//  \ \_____\  \ \_\  \ \_\\"\_\  \ \_____\  \ \_\ \_\  \ \_____\     \ \_\\"\_\  \ \_____\    \ \_\
//   \/_____/   \/_/   \/_/ \/_/   \/_____/   \/_/\/_/   \/_____/      \/_/ \/_/   \/_____/     \/_/
//
// 所有权利归Lingke Network (china)所有 | dream_pep拥有其艺术改变权力
// 未经允许的情况下删除此版权头可能会受到民事指控
// 请勿在未经Lingke Network (china)允许的范围内修改代码并分发

import { create } from "zustand";
import { microsoftLoginStart, microsoftLoginCallback } from "../api/auth";
import type { AuthResult } from "../api/auth";
import { saveAuth, deleteAuth } from "../api/auth-registry";
import {
  listAccounts,
  addOfflineAccount as apiAddOfflineAccount,
  addLittleskinAccount as apiAddLittleskinAccount,
  removeAccount as apiRemoveAccount,
  setActiveAccount as apiSetActiveAccount,
  type AuthAccount,
  type AuthStore,
} from "../api/auth-registry";

// 解析 xboxProfile（JSON 字符串 → 对象）
function parseXboxProfile(raw?: string): AuthResult["xboxProfile"] {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as AuthResult["xboxProfile"];
  } catch {
    return undefined;
  }
}

// 从注册表派生当前账号档案（供启动流程 launchStore 使用）
function deriveUser(store: AuthStore): AuthResult | null {
  const active = store.accounts.find((a) => a.id === store.activeAccountId);
  if (!active) return null;
  return {
    username: active.username,
    uuid: active.uuid,
    accessToken: active.accessToken ?? "",
    xboxProfile: parseXboxProfile(active.xboxProfile),
  };
}

interface AuthState {
  /** 当前激活账号档案（派生自 accounts + activeAccountId，兼容旧启动流程） */
  user: AuthResult | null;
  /** 多账号列表 */
  accounts: AuthAccount[];
  /** 当前激活账号 ID */
  activeAccountId: string | null;
  loading: boolean;
  error: string | null;
  msAuthUrl: string | null;
  msAuthState: string | null;

  initFromRegistry: () => Promise<void>;
  addOfflineAccount: (username: string) => Promise<boolean>;
  addLittleskinAccount: (username: string, password: string) => Promise<boolean>;
  removeAccount: (id: string) => Promise<boolean>;
  setActiveAccount: (id: string) => Promise<boolean>;
  /** 兼容旧调用：等价于添加离线账号 */
  loginOffline: (username: string) => Promise<void>;
  startMicrosoftLogin: (clientId: string) => Promise<void>;
  completeMicrosoftLogin: (code: string, clientId: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => {
  // 用注册表数据刷新状态（accounts / active / user）
  const applyStore = (store: AuthStore) =>
    set({
      accounts: store.accounts,
      activeAccountId: store.activeAccountId,
      user: deriveUser(store),
    });

  return {
    user: null,
    accounts: [],
    activeAccountId: null,
    loading: false,
    error: null,
    msAuthUrl: null,
    msAuthState: null,

    // 初始化：读取账号列表（含旧文件迁移）
    initFromRegistry: async () => {
      try {
        const store = await listAccounts();
        applyStore(store);
      } catch {
        // 没有账号数据时忽略
      }
    },

    // 添加离线账号
    addOfflineAccount: async (username) => {
      set({ loading: true, error: null });
      try {
        const store = await apiAddOfflineAccount(username);
        applyStore(store);
        set({ loading: false });
        return true;
      } catch (e) {
        set({ error: e instanceof Error ? e.message : String(e), loading: false });
        return false;
      }
    },

    // 添加 LittleSkin 账号
    addLittleskinAccount: async (username, password) => {
      set({ loading: true, error: null });
      try {
        const store = await apiAddLittleskinAccount(username, password);
        applyStore(store);
        set({ loading: false });
        return true;
      } catch (e) {
        set({ error: e instanceof Error ? e.message : String(e), loading: false });
        return false;
      }
    },

    // 删除账号
    removeAccount: async (id) => {
      set({ loading: true, error: null });
      try {
        const store = await apiRemoveAccount(id);
        applyStore(store);
        set({ loading: false });
        return true;
      } catch (e) {
        set({ error: e instanceof Error ? e.message : String(e), loading: false });
        return false;
      }
    },

    // 切换当前账号
    setActiveAccount: async (id) => {
      set({ error: null });
      try {
        const store = await apiSetActiveAccount(id);
        applyStore(store);
        return true;
      } catch (e) {
        set({ error: e instanceof Error ? e.message : String(e) });
        return false;
      }
    },

    // 兼容旧调用：添加离线账号
    loginOffline: async (username) => {
      set({ loading: true, error: null });
      try {
        const store = await apiAddOfflineAccount(username);
        applyStore(store);
        set({ loading: false });
      } catch (e) {
        set({ error: e instanceof Error ? e.message : String(e), loading: false });
      }
    },

    // 微软登录（当前 UI 不开放，保留链路）
    startMicrosoftLogin: async (clientId) => {
      set({ loading: true, error: null });
      try {
        const { state, authUrl } = await microsoftLoginStart(clientId);
        set({ msAuthUrl: authUrl, msAuthState: state, loading: false });
        window.electronAPI?.openExternal(authUrl);
      } catch (e) {
        set({ error: e instanceof Error ? e.message : String(e), loading: false });
      }
    },

    completeMicrosoftLogin: async (code, clientId) => {
      set({ loading: true, error: null });
      try {
        const user = await microsoftLoginCallback(code, clientId);
        set({ user, loading: false, msAuthUrl: null, msAuthState: null });
        // 同步写入旧版单账号文件（Koring 账号复用）
        await saveAuth({
          username: user.username,
          uuid: user.uuid,
          accessToken: user.accessToken || "",
          refreshToken: "",
          xboxProfile: user.xboxProfile ? JSON.stringify(user.xboxProfile) : "",
        });
      } catch (e) {
        set({ error: e instanceof Error ? e.message : String(e), loading: false });
      }
    },

    // 清理当前内存状态（不影响注册表中的账号列表）
    logout: async () => {
      set({ user: null, activeAccountId: null, msAuthUrl: null, msAuthState: null });
      await deleteAuth().catch(() => {});
    },

    clearError: () => set({ error: null }),
  };
});
