/**
 * 资源注册表 → zustand 镜像（供「资源与内存」调试面板消费）。
 * 模块加载即订阅注册表事件，事件节流由注册表内部保证，无轮询。
 */

import { create } from "zustand";
import { resourceRegistry } from "./registry";
import type { RegistrySnapshot } from "./types";

export interface ResourceStoreState {
  snapshot: RegistrySnapshot;
  refreshedAt: number;
  refresh: () => void;
  /** 释放全部「无引用」缓存条目（调试面板「释放缓存」按钮） */
  clearFree: () => void;
  resetCounters: () => void;
  setBudget: (kind: "background" | "image" | "blob" | "text", bytes: number) => void;
  budgets: Record<"background" | "image" | "blob" | "text", number>;
}

function emptySnapshot(): RegistrySnapshot {
  return {
    stats: { entries: 0, totalBytes: 0, hits: 0, misses: 0, evictions: 0, byKind: {} },
    entries: [],
  };
}

export const useResourceStore = create<ResourceStoreState>((set) => ({
  snapshot: emptySnapshot(),
  refreshedAt: 0,
  budgets: {
    background: resourceRegistry.getBudget("background"),
    image: resourceRegistry.getBudget("image"),
    blob: resourceRegistry.getBudget("blob"),
    text: resourceRegistry.getBudget("text"),
  },
  refresh: () =>
    set({
      snapshot: resourceRegistry.snapshot(),
      refreshedAt: Date.now(),
      budgets: {
        background: resourceRegistry.getBudget("background"),
        image: resourceRegistry.getBudget("image"),
        blob: resourceRegistry.getBudget("blob"),
        text: resourceRegistry.getBudget("text"),
      },
    }),
  clearFree: () => {
    resourceRegistry.clearFree();
    useResourceStore.getState().refresh();
  },
  resetCounters: () => {
    resourceRegistry.resetCounters();
    useResourceStore.getState().refresh();
  },
  setBudget: (kind, bytes) => {
    resourceRegistry.setBudget(kind, bytes);
    useResourceStore.getState().refresh();
  },
}));

let subscribed = false;

/** 幂等订阅（任意模块首次 import 后生效） */
function ensureSubscribed(): void {
  if (subscribed) return;
  subscribed = true;
  resourceRegistry.subscribe(() => {
    useResourceStore.getState().refresh();
  });
}

ensureSubscribed();
