import { create } from "zustand";
import { getVersionList, installMinecraft, installModLoader } from "../api/install";
import type { VersionManifest } from "../api/install";

interface ProgressInfo {
  stage: string;
  current: number;
  total: number;
  message?: string;
}

interface InstallState {
  versions: VersionManifest | null;
  loading: boolean;
  error: string | null;
  progress: ProgressInfo | null;
  installing: boolean;

  fetchVersions: (type?: string) => Promise<void>;
  install: (version: string, gamePath: string, javaPath?: string) => Promise<void>;
  installLoader: (
    mcVersion: string,
    gamePath: string,
    loaderType: "forge" | "fabric" | "quilt" | "neoforge",
    loaderVersion?: string,
    javaPath?: string
  ) => Promise<void>;
  clearError: () => void;
}

export const useInstallStore = create<InstallState>((set) => ({
  versions: null,
  loading: false,
  error: null,
  progress: null,
  installing: false,

  fetchVersions: async (type?: string) => {
    set({ loading: true, error: null });
    try {
      const versions = await getVersionList(type);
      set({ versions, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  install: async (version, gamePath, javaPath?) => {
    set({ installing: true, error: null, progress: null });
    try {
      await installMinecraft(version, gamePath, javaPath);
      set({ installing: false });
    } catch (e: any) {
      set({ error: e.message, installing: false });
    }
  },

  installLoader: async (mcVersion, gamePath, loaderType, loaderVersion?, javaPath?) => {
    set({ installing: true, error: null, progress: null });
    try {
      await installModLoader(mcVersion, gamePath, loaderType, loaderVersion, javaPath);
      set({ installing: false });
    } catch (e: any) {
      set({ error: e.message, installing: false });
    }
  },

  clearError: () => set({ error: null }),
}));
