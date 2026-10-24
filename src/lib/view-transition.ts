/**
 * 统一的方向性 View Transition。
 *
 * 页面/视图切换的语言统一为「旧内容先渐出 → 新内容再渐入」：
 * - 旧内容：180ms ease-in 淡出，并向“来时的反方向”小幅位移；
 * - 新内容：延迟 60ms 后 300ms 淡入，从“方向”侧小幅位移归位；
 * - 方向由调用方按空间关系决定（层级推入/返回、顶栏左右顺序、侧栏上下顺序、页签左右顺序）。
 *
 * 同一个元素名在切换期间临时挂到目标容器上（结束后清除），避免路由转场时
 * 页内视图名互相嵌套。
 */

import { useA11yStore } from "@/stores/a11yStore";

export type TransitionDirection = "forward" | "backward" | "sibling";

interface RunOptions {
  /** 减少动画（设置页开关）时直接切换 */
  disabled?: boolean;
  /** 参与过渡的容器（需要临时的 view-transition-name） */
  element?: HTMLElement | null;
  /** 临时 view-transition-name，例如 "store-content" / "instance-tab-content" */
  name?: string;
  /**
   * 本次转场的「来、去」两侧是否都有版本卡片。
   * 只有两侧都有卡片时，卡片上的 view-transition-name 才有真正的对应元素可做共享元素形变；
   * 单侧有卡（例如首页 → 设置页）时应关闭命名，让卡片并入整页内容一起做进出场，
   * 否则会变成孤立的命名快照，只做原地淡入（表现为「卡片不跟随页面动效、直接渐进出现」）。
   */
  cardPair?: boolean;
}

let activeTransition: ViewTransition | null = null;

/** 转场进行中又被要求切换时，暂存「最新一次」切换意图，等当前转场收尾后重放 */
interface PendingRun {
  dir: TransitionDirection;
  update: () => void;
  options: RunOptions;
}
let pendingRun: PendingRun | null = null;

function cleanup(element?: HTMLElement | null, name?: string) {
  if (element && name) element.style.viewTransitionName = "";
  const root = document.documentElement;
  delete root.dataset.transitionDir;
  delete root.dataset.vtScope;
  delete root.dataset.transitioning;
  delete root.dataset.vtCardPair;
}

function startTransition(dir: TransitionDirection, update: () => void, options: RunOptions) {
  const { element = null, name, cardPair } = options;
  const root = document.documentElement;
  root.dataset.transitionDir = dir;
  // route：转场作用于整个内容区；element：只作用于页内某个逻辑视图
  root.dataset.vtScope = element && name ? "element" : "route";
  // 转场期间隐藏 WebGL（Silk）画面，避免快照变黑
  root.dataset.transitioning = "";
  // 只有两侧都有版本卡片时才允许卡片作为共享元素参与转场（见 RunOptions.cardPair）
  if (cardPair === false) root.dataset.vtCardPair = "off";
  if (element && name) element.style.viewTransitionName = name;

  let transition: ViewTransition;
  try {
    transition = document.startViewTransition(update);
  } catch {
    cleanup(element, name);
    update();
    return;
  }

  activeTransition = transition;
  transition.ready.catch(() => {});
  transition.updateCallbackDone.catch(() => {});
  transition.finished
    .catch(() => {})
    .finally(() => {
      if (activeTransition === transition) activeTransition = null;
      cleanup(element, name);
      // 转场期间被点击过：从已稳定的新状态立刻再转一次，避免「直接闪过去」
      const next = pendingRun;
      pendingRun = null;
      if (next) startTransition(next.dir, next.update, next.options);
    });
}

/**
 * @param dir 方向：forward / backward / sibling
 * @param update 执行真正的状态切换（路由 set / 页签 set 等）
 */
export function runViewTransition(
  dir: TransitionDirection,
  update: () => void,
  { disabled = false, element = null, name, cardPair }: RunOptions = {},
) {
  const options: RunOptions = { disabled, element, name, cardPair };
  const reduceMotion = disabled || useA11yStore.getState().reduceMotion;
  if (reduceMotion || !document.startViewTransition) {
    update();
    return;
  }

  // 转场进行中再次切换：记录最新的切换意图，并让当前转场立即收尾。
  // 等 finished 后用新状态重开一次转场，表现是「反向/继续切换」也有动画，
  // 而不是 aborted 之后直接跳到终点。
  if (activeTransition) {
    pendingRun = { dir, update, options };
    try {
      activeTransition.skipTransition();
    } catch {
      // 忽略：个别实现不支持 skipTransition 时由 finished 收尾逻辑重放
    }
    return;
  }

  startTransition(dir, update, options);
}

/** 顺序列表里的方向：去更靠后的项 = forward，更靠前 = backward，相等 = sibling */
export function directionFromIndex(from: number, to: number): TransitionDirection {
  if (to > from) return "forward";
  if (to < from) return "backward";
  return "sibling";
}
