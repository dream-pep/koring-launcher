import { create } from "zustand";

export type RouteKey =
  | "home"
  | "store"
  | "today"
  | "play-link"
  | "setting"
  | "gallery"
  | "task-queue"
  | "oobe"
  | "oobe/about-info"
  | "debug"
  | "debug-splash"
  | "debug-display"
  | "debug-version-card"
  | "debug-task";

export type TitleBarMode = "default" | "sub" | "window" | "oobe";

export type TransitionDirection = "forward" | "backward";

interface RouteItem {
  key: RouteKey;
  label: string;
  path: string;
  hidden?: boolean;
  backable?: boolean;
}

export const routes: RouteItem[] = [
  { key: "home", label: "首页", path: "/home" },
  { key: "gallery", label: "实例", path: "/gallery" },
  { key: "store", label: "资源", path: "/store" },
  { key: "today", label: "资讯", path: "/today" },
  { key: "play-link", label: "联机", path: "/play-link" },
  { key: "setting", label: "设置", path: "/setting" },
];

export const allRoutes: RouteItem[] = [
  ...routes,
  { key: "task-queue", label: "任务队列", path: "/task-queue", hidden: true },
  { key: "oobe", label: "OOBE", path: "/oobe", hidden: true },
  { key: "oobe/about-info", label: "关于信息", path: "/oobe/about-info", hidden: true, backable: true },
  { key: "debug", label: "调试", path: "/debug", hidden: true },
  { key: "debug-splash", label: "启动动画调试", path: "/debug/splash", hidden: true },
  { key: "debug-display", label: "显示效果调试", path: "/debug/display", hidden: true },
  { key: "debug-version-card", label: "版本卡片调试", path: "/debug/version-card", hidden: true },
  { key: "debug-task", label: "任务队列调试", path: "/debug/task", hidden: true },
];

const topLevelKeys = new Set(routes.map((r) => r.key));

function getRouteTitleBarMode(key: RouteKey): TitleBarMode {
  if (key === "oobe") return "oobe";
  return topLevelKeys.has(key) ? "default" : "sub";
}

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
  history: RouteKey[];
  navigate: (key: RouteKey) => void;
  setTitleBarMode: (mode: TitleBarMode) => void;
  goBack: () => void;
}

export const useRouteStore = create<RouteState>((set, get) => ({
  current: "home",
  titleBarMode: "default",
  direction: "forward",
  history: [],
  navigate: (key) => {
    const prev = get().current;
    if (prev === key) return;
    startTransition("forward", () => {
      set({
        current: key,
        titleBarMode: getRouteTitleBarMode(key),
        direction: "forward",
        history: [...get().history, prev],
      });
    });
  },
  setTitleBarMode: (mode) => set({ titleBarMode: mode }),
  goBack: () => {
    const { history } = get();
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    startTransition("backward", () => {
      set({
        current: prev,
        titleBarMode: getRouteTitleBarMode(prev),
        history: history.slice(0, -1),
        direction: "backward",
      });
    });
  },
}));
