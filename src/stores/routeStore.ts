import { create } from "zustand";

export type RouteKey =
  | "home"
  | "store"
  | "today"
  | "play-link"
  | "setting"
  | "task-queue"
  | "debug"
  | "debug-splash"
  | "debug-display"
  | "debug-version-card"
  | "debug-task";

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
  { key: "task-queue", label: "任务队列", path: "/task-queue", hidden: true },
  { key: "debug", label: "调试", path: "/debug", hidden: true },
  { key: "debug-splash", label: "启动动画调试", path: "/debug/splash", hidden: true },
  { key: "debug-display", label: "显示效果调试", path: "/debug/display", hidden: true },
  { key: "debug-version-card", label: "版本卡片调试", path: "/debug/version-card", hidden: true },
  { key: "debug-task", label: "任务队列调试", path: "/debug/task", hidden: true },
];

const parentMap: Partial<Record<RouteKey, RouteKey>> = {
  "task-queue": "home",
  debug: "setting",
  "debug-splash": "debug",
  "debug-display": "debug",
  "debug-version-card": "debug",
  "debug-task": "debug",
};

const topLevelKeys = new Set(routes.map((r) => r.key));

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
    startTransition("forward", () => {
      set({
        current: key,
        titleBarMode: parent && !topLevelKeys.has(key) ? "sub" : "default",
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
          titleBarMode: topLevelKeys.has(parent) ? "default" : "sub",
          direction: "backward",
        });
      });
    }
  },
}));
