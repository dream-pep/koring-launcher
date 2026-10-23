import { create } from "zustand";
import {
  createInstance,
  listInstances,
  deleteInstance,
  getInstanceInfo,
  getInstanceIcon,
  setInstanceIcon,
  resetInstanceIcon,
  updateInstance,
  installInstance,
  type InstanceConfig,
  type InstanceIconInfo,
  type InstanceInfo,
  type InstanceRuntime,
} from "../api/instance";

const EMPTY_ICON: InstanceIconInfo = { url: null, source: null, mtimeMs: 0, bytes: 0 };

/** 图标请求去重：同一实例在同一 gamePath 下只请求一次（切页/重渲染复用） */
const iconRequests = new Map<string, Promise<InstanceIconInfo>>();

function iconKey(name: string, gamePath: string): string {
  return `${gamePath}::${name}`;
}

/** 画廊可编辑的实例元数据（写入 instance.json） */
export type InstanceMetaPatch = Partial<
  Pick<InstanceConfig, "favorite" | "category" | "description" | "minMemory" | "maxMemory">
>;

interface InstanceState {
  instances: InstanceInfo[];
  currentInstance: InstanceInfo | null;
  loading: boolean;
  error: string | null;
  /** 实例图标（按实例名索引）；未加载的实例没有条目 */
  icons: Record<string, InstanceIconInfo>;

  fetchInstances: (gamePath: string) => Promise<void>;
  create: (
    name: string,
    gamePath: string,
    runtime: InstanceRuntime,
    options?: {
      author?: string;
      description?: string;
      java?: string;
      minMemory?: number;
      maxMemory?: number;
    }
  ) => Promise<void>;
  remove: (name: string, gamePath: string) => Promise<void>;
  select: (name: string, gamePath: string) => Promise<void>;
  install: (name: string, gamePath: string) => Promise<string>;
  /** 读取实例图标；force = true 时忽略缓存重新读（刷新 / 换图标后用） */
  loadIcon: (name: string, gamePath: string, force?: boolean) => Promise<void>;
  /** 从本地图片设置图标 */
  setIcon: (name: string, gamePath: string, sourcePath: string) => Promise<void>;
  /** 清除图标，回到默认图标 */
  resetIcon: (name: string, gamePath: string) => Promise<void>;
  /** 写入元数据（收藏 / 分类 / 显示名 / 内存），成功后只更新对应实例 */
  updateMeta: (name: string, gamePath: string, patch: InstanceMetaPatch) => Promise<InstanceInfo | null>;
  /** 批量写入元数据（分类重命名、批量归类的用） */
  bulkUpdateMeta: (names: string[], gamePath: string, patch: InstanceMetaPatch) => Promise<void>;
  clearError: () => void;
}

export const useInstanceStore = create<InstanceState>((set, get) => ({
  instances: [],
  currentInstance: null,
  loading: false,
  error: null,
  icons: {},

  fetchInstances: async (gamePath: string) => {
    set({ loading: true, error: null });
    try {
      const instances = await listInstances(gamePath);
      set({ instances, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  create: async (name, gamePath, runtime, options?) => {
    set({ loading: true, error: null });
    try {
      const instance = await createInstance(name, gamePath, runtime, options);
      set((state) => ({
        instances: [...state.instances, instance],
        loading: false,
      }));
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  remove: async (name, gamePath) => {
    set({ loading: true, error: null });
    try {
      await deleteInstance(name, gamePath);
      iconRequests.delete(iconKey(name, gamePath));
      set((state) => ({
        instances: state.instances.filter((i) => i.name !== name),
        currentInstance:
          state.currentInstance?.name === name ? null : state.currentInstance,
        loading: false,
      }));
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  select: async (name, gamePath) => {
    set({ loading: true, error: null });
    try {
      const instance = await getInstanceInfo(name, gamePath);
      set({ currentInstance: instance, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  install: async (name, gamePath) => {
    set({ loading: true, error: null });
    try {
      const { requestId } = await installInstance(name, gamePath);
      set({ loading: false });
      return requestId;
    } catch (e: any) {
      set({ error: e.message, loading: false });
      throw e;
    }
  },

  loadIcon: async (name, gamePath, force = false) => {
    const key = iconKey(name, gamePath);
    if (!force) {
      // 已有结果直接复用；正在进行中的请求共享同一个 Promise
      if (get().icons[name]) return;
      const pending = iconRequests.get(key);
      if (pending) {
        const info = await pending;
        set((state) => ({ icons: { ...state.icons, [name]: info } }));
        return;
      }
    }

    const request = getInstanceIcon(name, gamePath).catch(() => EMPTY_ICON);
    iconRequests.set(key, request);
    const info = await request;
    set((state) => ({ icons: { ...state.icons, [name]: info } }));
  },

  setIcon: async (name, gamePath, sourcePath) => {
    const info = await setInstanceIcon(name, gamePath, sourcePath);
    iconRequests.set(iconKey(name, gamePath), Promise.resolve(info));
    set((state) => ({ icons: { ...state.icons, [name]: info } }));
  },

  resetIcon: async (name, gamePath) => {
    const info = await resetInstanceIcon(name, gamePath);
    iconRequests.set(iconKey(name, gamePath), Promise.resolve(info));
    set((state) => ({ icons: { ...state.icons, [name]: info } }));
  },

  updateMeta: async (name, gamePath, patch) => {
    try {
      const updated = await updateInstance(name, gamePath, patch);
      set((state) => ({
        instances: state.instances.map((i) => (i.name === name ? updated : i)),
        currentInstance: state.currentInstance?.name === name ? updated : state.currentInstance,
      }));
      return updated;
    } catch (e: any) {
      set({ error: e.message });
      return null;
    }
  },

  bulkUpdateMeta: async (names, gamePath, patch) => {
    const updated: InstanceInfo[] = [];
    for (const name of names) {
      try {
        updated.push(await updateInstance(name, gamePath, patch));
      } catch (e: any) {
        set({ error: e.message });
      }
    }
    if (updated.length === 0) return;
    const byName = new Map(updated.map((info) => [info.name, info]));
    set((state) => ({
      instances: state.instances.map((i) => byName.get(i.name) ?? i),
      currentInstance: state.currentInstance
        ? byName.get(state.currentInstance.name) ?? state.currentInstance
        : null,
    }));
  },

  clearError: () => set({ error: null }),
}));
