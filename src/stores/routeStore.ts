import { create } from "zustand";
import { runViewTransition, type TransitionDirection } from "@/lib/view-transition";

export type { TransitionDirection };

export type RouteKey =
  | "home"
  | "store"
  | "today"
  | "play-link"
  | "setting"
  | "setting/login"
  | "gallery"
  | "task-queue"
  | "update"
  | "device-blocked"
  | "oobe"
  | "oobe/language"
  | "oobe/device"
  | "oobe/agreement"
  | "oobe/version"
  | "oobe/about-version"
  | "oobe/beta-test"
  | "oobe/activation"
  | "oobe/login"
  | "oobe/welcome"
  | "oobe/finish"
  | "oobe/about-info"
  | "oobe/legal"
  | "upvp"
  | "upvp/complete"
  | "upvp/device"
  | "upvp/version"
  | "upvp/about-version"
  | "upvp/check"
  | "upvp/beta-test"
  | "upvp/activation"
  | "upvp/finish"
  | "debug"
  | "debug-splash"
  | "debug-display"
  | "debug-version-card"
  | "debug-update"
  | "debug-task"
  | "debug-activation"
  | "debug-resource"
  | "debug-crash"
  | "debug-routes";
export type TitleBarMode = "default" | "sub" | "window" | "oobe" | "blocked";

/**
 * 转场方向语义（由“用户从哪来、往哪去”决定）：
 * - forward  ：进入更深层级 / 往空间顺序的后方切换（新页从右侧渐入，旧页向左渐出）；
 * - backward ：返回更浅层级 / 往空间顺序的前方切换（镜像）；
 * - sibling  ：没有明确空间关系的同层级切换，只做纯渐隐渐现。
 * OOBE / UPVP 向导属于同一流程，按步骤先后使用 forward / backward。
 */

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
  { key: "update", label: "更新日志", path: "/update", hidden: true, backable: true },
  { key: "device-blocked", label: "设备异常", path: "/device-blocked", hidden: true },
  { key: "oobe", label: "OOBE", path: "/oobe", hidden: true },
  { key: "oobe/language", label: "语言设置", path: "/oobe/language", hidden: true },
  { key: "oobe/device", label: "设备校验", path: "/oobe/device", hidden: true },
  { key: "oobe/agreement", label: "同意协议", path: "/oobe/agreement", hidden: true },
  { key: "oobe/version", label: "当前版本", path: "/oobe/version", hidden: true },
  { key: "oobe/about-version", label: "关于此版本", path: "/oobe/about-version", hidden: true },
  { key: "oobe/beta-test", label: "测试协议", path: "/oobe/beta-test", hidden: true },
  { key: "oobe/activation", label: "版本激活", path: "/oobe/activation", hidden: true },
  { key: "oobe/login", label: "登录", path: "/oobe/login", hidden: true },
  { key: "oobe/welcome", label: "欢迎", path: "/oobe/welcome", hidden: true },
  { key: "oobe/finish", label: "完成", path: "/oobe/finish", hidden: true },
  { key: "oobe/about-info", label: "关于信息", path: "/oobe/about-info", hidden: true, backable: true },
  { key: "oobe/legal", label: "法律信息", path: "/oobe/legal", hidden: true },
  { key: "upvp", label: "更新引导", path: "/upvp", hidden: true },
  { key: "upvp/complete", label: "更新已完成", path: "/upvp/complete", hidden: true },
  { key: "upvp/device", label: "设备校验", path: "/upvp/device", hidden: true },
  { key: "upvp/version", label: "当前版本", path: "/upvp/version", hidden: true },
  { key: "upvp/about-version", label: "关于此版本", path: "/upvp/about-version", hidden: true },
  { key: "upvp/check", label: "检查版本", path: "/upvp/check", hidden: true },
  { key: "upvp/beta-test", label: "测试协议", path: "/upvp/beta-test", hidden: true },
  { key: "upvp/activation", label: "版本激活", path: "/upvp/activation", hidden: true },
  { key: "upvp/finish", label: "完成", path: "/upvp/finish", hidden: true },
  { key: "debug", label: "调试", path: "/debug", hidden: true },
  { key: "debug-splash", label: "启动动画调试", path: "/debug/splash", hidden: true },
  { key: "debug-display", label: "显示效果调试", path: "/debug/display", hidden: true },
  { key: "debug-version-card", label: "版本卡片调试", path: "/debug/version-card", hidden: true },
  { key: "debug-update", label: "更新功能测试", path: "/debug/update", hidden: true },
  { key: "debug-task", label: "任务队列调试", path: "/debug/task", hidden: true },
  { key: "debug-activation", label: "激活校验测试", path: "/debug/activation", hidden: true },
  { key: "debug-resource", label: "资源与内存", path: "/debug/resource", hidden: true },
  { key: "debug-crash", label: "崩溃测试", path: "/debug/crash", hidden: true },
  { key: "debug-routes", label: "页面跳转", path: "/debug/routes", hidden: true },
];

const topLevelKeys = new Set(routes.map((r) => r.key));

function getRouteTitleBarMode(key: RouteKey): TitleBarMode {
  // 设备异常页：顶栏只保留品牌与窗口控制（无胶囊菜单、无任务按钮、无返回）
  if (key === "device-blocked") return "blocked";
  if (key === "oobe" || key.startsWith("oobe/") || key === "upvp" || key.startsWith("upvp/")) return "oobe";
  return topLevelKeys.has(key) ? "default" : "sub";
}

/** 页面层级：0 = 顶栏主导航页，1 = 二级页（设置子页/更新/任务/调试/流程入口），2 = 三级页或向导步骤 */
const LEVEL_ONE_KEYS = new Set<RouteKey>([
  "setting/login",
  "update",
  "task-queue",
  "device-blocked",
  "debug",
  "oobe",
  "upvp",
]);

function getRouteDepth(key: RouteKey): number {
  if (topLevelKeys.has(key)) return 0;
  if (LEVEL_ONE_KEYS.has(key)) return 1;
  return 2;
}

/** 同一向导流程内的步骤顺序：步骤前进/后退必须带方向，而不是同级交叉淡化 */
const FLOW_STEPS: Partial<Record<RouteKey, number>> = {
  oobe: 0,
  "oobe/language": 1,
  "oobe/device": 2,
  "oobe/agreement": 3,
  "oobe/login": 4,
  "oobe/welcome": 5,
  "oobe/version": 6,
  "oobe/about-version": 7,
  "oobe/beta-test": 8,
  "oobe/activation": 9,
  "oobe/finish": 10,
  "oobe/about-info": 11,
  "oobe/legal": 12,
  upvp: 0,
  "upvp/complete": 1,
  "upvp/device": 2,
  "upvp/version": 3,
  "upvp/about-version": 4,
  "upvp/check": 5,
  "upvp/beta-test": 6,
  "upvp/activation": 7,
  "upvp/finish": 8,
};

function getFlow(key: RouteKey): "oobe" | "upvp" | null {
  if (key === "oobe" || key.startsWith("oobe/")) return "oobe";
  if (key === "upvp" || key.startsWith("upvp/")) return "upvp";
  return null;
}

/** 根据「出发页 → 目标页」的层级关系决定转场方向 */
function getTransitionDirection(from: RouteKey, to: RouteKey): TransitionDirection {
  // 同一向导流程：按步骤先后决定方向（向导内部是线性推进，不是同级切换）
  const fromFlow = getFlow(from);
  if (fromFlow && fromFlow === getFlow(to)) {
    const a = FLOW_STEPS[from] ?? 0;
    const b = FLOW_STEPS[to] ?? 0;
    if (b > a) return "forward";
    if (b < a) return "backward";
    return "sibling";
  }

  const fromDepth = getRouteDepth(from);
  const toDepth = getRouteDepth(to);
  if (toDepth > fromDepth) return "forward";
  if (toDepth < fromDepth) return "backward";

  // 顶层导航之间：方向跟随顶栏胶囊的空间顺序（向右切换 → 从右侧进入，向左切换 → 反之），
  // 与用户手指/鼠标在顶栏上的移动方向一致。
  if (fromDepth === 0 && toDepth === 0) {
    const fromIndex = routes.findIndex((r) => r.key === from);
    const toIndex = routes.findIndex((r) => r.key === to);
    if (toIndex > fromIndex) return "forward";
    if (toIndex < fromIndex) return "backward";
  }

  // 其余同层级（不同二级页之间、调试子页之间）：没有明确的空间关系，用交叉淡化
  return "sibling";
}

/** 反向转场：返回时沿进入路径原路返回 */
function reverseDirection(dir: TransitionDirection): TransitionDirection {
  if (dir === "forward") return "backward";
  if (dir === "backward") return "forward";
  return "sibling";
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
    // 方向由页面层级决定：进入二级页 → forward；回到顶部页 → backward；同级 → sibling
    const direction = getTransitionDirection(prev, key);
    runViewTransition(direction, () => {
      set({
        current: key,
        titleBarMode: getRouteTitleBarMode(key),
        direction,
        history: [...get().history, prev],
      });
    });
  },
  setTitleBarMode: (mode) => set({ titleBarMode: mode }),
  setStoreSection: (section) => set({ storeSection: section }),
  goBack: () => {
    const { history, current } = get();
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    // 返回 = 反向重放来时的转场（深层→浅层 exact backwards，同级仍是交叉淡化）
    const direction = reverseDirection(getTransitionDirection(prev, current));
    runViewTransition(direction, () => {
      set({
        current: prev,
        titleBarMode: getRouteTitleBarMode(prev),
        history: history.slice(0, -1),
        direction,
      });
    });
  },
}));
