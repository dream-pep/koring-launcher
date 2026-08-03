import { create } from "zustand";

export type RouteKey =
  | "home"
  | "store"
  | "today"
  | "play-link"
  | "setting"
  | "setting/login"
  | "gallery"
  | "task-queue"
  | "oobe"
  | "oobe/language"
  | "oobe/agreement"
  | "oobe/version"
  | "oobe/beta-test"
  | "oobe/login"
  | "oobe/welcome"
  | "oobe/finish"
  | "oobe/about-info"
  | "oobe/legal"
  | "debug"
  | "debug-splash"
  | "debug-display"
  | "debug-version-card"
  | "debug-task"
  | "debug-crash";

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
  { key: "setting/login", label: "登录", path: "/setting/login", hidden: true, backable: true },
  { key: "task-queue", label: "任务队列", path: "/task-queue", hidden: true },
  { key: "oobe", label: "OOBE", path: "/oobe", hidden: true },
  { key: "oobe/language", label: "语言设置", path: "/oobe/language", hidden: true },
  { key: "oobe/agreement", label: "同意协议", path: "/oobe/agreement", hidden: true },
  { key: "oobe/version", label: "当前版本", path: "/oobe/version", hidden: true },
  { key: "oobe/beta-test", label: "测试协议", path: "/oobe/beta-test", hidden: true },
  { key: "oobe/login", label: "登录", path: "/oobe/login", hidden: true },
  { key: "oobe/welcome", label: "欢迎", path: "/oobe/welcome", hidden: true },
  { key: "oobe/finish", label: "完成", path: "/oobe/finish", hidden: true },
  { key: "oobe/about-info", label: "关于信息", path: "/oobe/about-info", hidden: true, backable: true },
  { key: "oobe/legal", label: "法律信息", path: "/oobe/legal", hidden: true },
  { key: "debug", label: "调试", path: "/debug", hidden: true },
  { key: "debug-splash", label: "启动动画调试", path: "/debug/splash", hidden: true },
  { key: "debug-display", label: "显示效果调试", path: "/debug/display", hidden: true },
  { key: "debug-version-card", label: "版本卡片调试", path: "/debug/version-card", hidden: true },
  { key: "debug-task", label: "任务队列调试", path: "/debug/task", hidden: true },
];

const topLevelKeys = new Set(routes.map((r) => r.key));

function getRouteTitleBarMode(key: RouteKey): TitleBarMode {
  if (key === "oobe" || key.startsWith("oobe/")) return "oobe";
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
  /** 资源中心选中的分类（原版游戏 / MOD / 整合包） */
  storeSection: "game" | "mod" | "modpack";
  navigate: (key: RouteKey) => void;
  setTitleBarMode: (mode: TitleBarMode) => void;
  setStoreSection: (section: "game" | "mod" | "modpack") => void;
  goBack: () => void;
}

export const useRouteStore = create<RouteState>((set, get) => ({
  current: "home",
  titleBarMode: "default",
  direction: "forward",
  history: [],
  storeSection: "game",
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
  setStoreSection: (section) => set({ storeSection: section }),
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
