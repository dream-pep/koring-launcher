import { create } from "zustand";
import {
  createInstance,
  listInstances,
  deleteInstance,
  getInstanceInfo,
} from "../api/instance";
import type { InstanceInfo } from "../api/instance";

interface InstanceState {
  instances: InstanceInfo[];
  currentInstance: InstanceInfo | null;
  loading: boolean;
  error: string | null;

  fetchInstances: (instancesPath: string) => Promise<void>;
  create: (
    name: string,
    gamePath: string,
    mcVersion: string,
    loaderType?: string,
    loaderVersion?: string,
    javaPath?: string,
    memory?: { min?: string; max?: string }
  ) => Promise<void>;
  remove: (name: string, instancesPath: string) => Promise<void>;
  select: (name: string, instancesPath: string) => Promise<void>;
  clearError: () => void;
}

export const useInstanceStore = create<InstanceState>((set) => ({
  instances: [],
  currentInstance: null,
  loading: false,
  error: null,

  fetchInstances: async (instancesPath: string) => {
    set({ loading: true, error: null });
    try {
      const instances = await listInstances(instancesPath);
      set({ instances, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  create: async (
    name,
    gamePath,
    mcVersion,
    loaderType?,
    loaderVersion?,
    javaPath?,
    memory?
  ) => {
    set({ loading: true, error: null });
    try {
      const instance = await createInstance(
        name,
        gamePath,
        mcVersion,
        loaderType,
        loaderVersion,
        javaPath,
        memory
      );
      set((state) => ({
        instances: [...state.instances, instance],
        loading: false,
      }));
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  remove: async (name: string, instancesPath: string) => {
    set({ loading: true, error: null });
    try {
      await deleteInstance(name, instancesPath);
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

  select: async (name: string, instancesPath: string) => {
    set({ loading: true, error: null });
    try {
      const instance = await getInstanceInfo(name, instancesPath);
      set({ currentInstance: instance, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
