import { create } from "zustand";
import {
  createInstance,
  listInstances,
  deleteInstance,
  getInstanceInfo,
  installInstance,
  launchInstance,
  type InstanceInfo,
  type InstanceRuntime,
} from "../api/instance";

interface InstanceState {
  instances: InstanceInfo[];
  currentInstance: InstanceInfo | null;
  loading: boolean;
  error: string | null;

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
  launch: (
    name: string,
    gamePath: string,
    options: {
      username: string;
      uuid: string;
      accessToken?: string;
      javaPath?: string;
      server?: { host: string; port?: number };
    }
  ) => Promise<string>;
  clearError: () => void;
}

export const useInstanceStore = create<InstanceState>((set) => ({
  instances: [],
  currentInstance: null,
  loading: false,
  error: null,

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

  remove: async (name: string, gamePath: string) => {
    set({ loading: true, error: null });
    try {
      await deleteInstance(name, gamePath);
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

  select: async (name: string, gamePath: string) => {
    set({ loading: true, error: null });
    try {
      const instance = await getInstanceInfo(name, gamePath);
      set({ currentInstance: instance, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  install: async (name: string, gamePath: string) => {
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

  launch: async (name, gamePath, options) => {
    set({ loading: true, error: null });
    try {
      const { requestId } = await launchInstance(name, gamePath, options);
      set({ loading: false });
      return requestId;
    } catch (e: any) {
      set({ error: e.message, loading: false });
      throw e;
    }
  },

  clearError: () => set({ error: null }),
}));
