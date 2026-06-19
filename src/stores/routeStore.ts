import { create } from "zustand";

export type RouteKey = "home" | "store" | "today" | "play-link" | "setting" | "debug";

export type TitleBarMode = "default" | "sub" | "window";

export type TransitionDirection = "forward" | "backward";

interface RouteItem {
  key: RouteKey;
  label: string;
  path: string;
  hidden?: boolean;
}

export const routes: RouteItem[] = [
  { key: "home", label: "首页", path: "/home" },
  { key: "store", label: "资源", path: "/store" },
  { key: "today", label: "资讯", path: "/today" },
  { key: "play-link", label: "联机", path: "/play-link" },
  { key: "setting", label: "设置", path: "/setting" },
];

export const allRoutes: RouteItem[] = [
  ...routes,
  { key: "debug", label: "调试", path: "/debug", hidden: true },
];

const parentMap: Partial<Record<RouteKey, RouteKey>> = {
  debug: "setting",
};

function startTransition(dir: TransitionDirection, callback: () => void) {
  document.documentElement.dataset.transitionDir = dir;
  if (document.startViewTransition) {
    document.startViewTransition(callback);
  } else {
    callback();
  }
}

interface RouteState {
  current: RouteKey;
  titleBarMode: TitleBarMode;
  direction: TransitionDirection;
  navigate: (key: RouteKey) => void;
  setTitleBarMode: (mode: TitleBarMode) => void;
  goBack: () => void;
}

export const useRouteStore = create<RouteState>((set, get) => ({
  current: "home",
  titleBarMode: "default",
  direction: "forward",
  navigate: (key) => {
    const parent = parentMap[key];
    const isForward = parent !== undefined;
    startTransition("forward", () => {
      set({
        current: key,
        titleBarMode: isForward ? "sub" : "default",
        direction: "forward",
      });
    });
  },
  setTitleBarMode: (mode) => set({ titleBarMode: mode }),
  goBack: () => {
    const { current } = get();
    const parent = parentMap[current];
    if (parent) {
      startTransition("backward", () => {
        set({
          current: parent,
          titleBarMode: "default",
          direction: "backward",
        });
      });
    }
  },
}));
