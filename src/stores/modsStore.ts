import { create } from "zustand";
import { searchMods, getModDetail, getModVersions, installMod } from "../api/mods";
import type { ModSearchResult, ModVersionResult } from "../api/mods";

interface ModsState {
  searchResults: ModSearchResult[];
  currentMod: ModSearchResult | null;
  modVersions: ModVersionResult[];
  loading: boolean;
  error: string | null;

  search: (
    query?: string,
    gameVersion?: string,
    loader?: string,
    source?: "modrinth" | "curseforge"
  ) => Promise<void>;
  getDetail: (projectId: string, source: "modrinth" | "curseforge") => Promise<void>;
  getVersions: (
    projectId: string,
    gameVersion?: string,
    loader?: string,
    source?: "modrinth" | "curseforge"
  ) => Promise<void>;
  install: (
    projectId: string,
    versionId: string | undefined,
    gamePath: string,
    source?: "modrinth" | "curseforge"
  ) => Promise<void>;
  clearError: () => void;
  clear: () => void;
}

export const useModsStore = create<ModsState>((set) => ({
  searchResults: [],
  currentMod: null,
  modVersions: [],
  loading: false,
  error: null,

  search: async (query?, gameVersion?, loader?, source = "modrinth") => {
    set({ loading: true, error: null });
    try {
      const results = await searchMods(query, gameVersion, loader, 20, 0, source);
      set({ searchResults: results, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  getDetail: async (projectId, source) => {
    set({ loading: true, error: null });
    try {
      const detail = await getModDetail(projectId, source);
      set({ currentMod: detail, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  getVersions: async (projectId, gameVersion?, loader?, source = "modrinth") => {
    set({ loading: true, error: null });
    try {
      const versions = await getModVersions(projectId, gameVersion, loader, source);
      set({ modVersions: versions, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  install: async (projectId, versionId, gamePath, source = "modrinth") => {
    set({ loading: true, error: null });
    try {
      await installMod(projectId, versionId, gamePath, source);
      set({ loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  clearError: () => set({ error: null }),

  clear: () =>
    set({
      searchResults: [],
      currentMod: null,
      modVersions: [],
    }),
}));
