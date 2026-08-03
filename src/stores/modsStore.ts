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
import { searchMods, getModDetail, getModVersions, installMod } from "../api/mods";
import type { ModSearchResult, ModVersionResult, ModSearchResponse } from "../api/mods";

export interface ModSearchParams {
  query?: string;
  gameVersion?: string;
  loader?: string;
  category?: string;
  projectType?: string;
  page?: number;
  pageSize?: number;
  source?: "modrinth" | "curseforge";
  /** 为 true 时将结果追加到已有列表（用于无限滚动），否则替换 */
  append?: boolean;
}

interface ModsState {
  searchResults: ModSearchResult[];
  total: number;
  currentPage: number;
  pageSize: number;
  hasMore: boolean;
  currentMod: ModSearchResult | null;
  modVersions: ModVersionResult[];
  loading: boolean;
  installing: boolean;
  error: string | null;

  search: (params?: ModSearchParams) => Promise<ModSearchResponse | null>;
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

export const useModsStore = create<ModsState>((set, get) => ({
  searchResults: [],
  total: 0,
  currentPage: 1,
  pageSize: 12,
  hasMore: false,
  currentMod: null,
  modVersions: [],
  loading: false,
  installing: false,
  error: null,

  search: async (params = {}) => {
    const {
      query,
      gameVersion,
      loader,
      category,
      projectType = "mod",
      page = 1,
      pageSize = get().pageSize,
      source = "modrinth",
      append = false,
    } = params;

    // 追加模式不需要整体 loading（保持旧列表可见）
    if (!append) set({ loading: true, error: null });
    try {
      const offset = (page - 1) * pageSize;
      const response = await searchMods(query, gameVersion, loader, category, projectType, pageSize, offset, source);
      set((state) => ({
        searchResults: append ? [...state.searchResults, ...response.hits] : response.hits,
        total: response.total,
        currentPage: page,
        pageSize,
        hasMore: state.searchResults.length + response.hits.length < response.total,
        loading: false,
      }));
      return response;
    } catch (e: any) {
      set({ error: e.message, loading: false });
      return null;
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
    set({ installing: true, error: null });
    try {
      await installMod(projectId, versionId, gamePath, source);
      set({ installing: false });
    } catch (e: any) {
      set({ error: e.message, installing: false });
    }
  },

  clearError: () => set({ error: null }),

  clear: () =>
    set({
      searchResults: [],
      total: 0,
      currentPage: 1,
      hasMore: false,
      currentMod: null,
      modVersions: [],
    }),
}));
