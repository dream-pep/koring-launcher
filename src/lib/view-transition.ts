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
}

let activeTransition: ViewTransition | null = null;

function cleanup(element?: HTMLElement | null, name?: string) {
  if (element && name) element.style.viewTransitionName = "";
  const root = document.documentElement;
  delete root.dataset.transitionDir;
  delete root.dataset.vtScope;
  delete root.dataset.transitioning;
}

/**
 * @param dir 方向：forward / backward / sibling
 * @param update 执行真正的状态切换（路由 set / 页签 set 等）
 */
export function runViewTransition(
  dir: TransitionDirection,
  update: () => void,
  { disabled = false, element = null, name }: RunOptions = {},
) {
  const reduceMotion = disabled || useA11yStore.getState().reduceMotion;
  if (reduceMotion || !document.startViewTransition || activeTransition) {
    update();
    return;
  }

  const root = document.documentElement;
  root.dataset.transitionDir = dir;
  // route：转场作用于整个内容区；element：只作用于页内某个逻辑视图
  root.dataset.vtScope = element && name ? "element" : "route";
  // 转场期间隐藏 WebGL（Silk）画面，避免快照变黑
  root.dataset.transitioning = "";
  if (element && name) element.style.viewTransitionName = name;

  try {
    const transition = document.startViewTransition(update);
    activeTransition = transition;
    transition.ready.catch(() => {});
    transition.finished
      .catch(() => {})
      .finally(() => {
        if (activeTransition === transition) activeTransition = null;
        cleanup(element, name);
      });
  } catch {
    activeTransition = null;
    cleanup(element, name);
    update();
  }
}

/** 顺序列表里的方向：去更靠后的项 = forward，更靠前 = backward，相等 = sibling */
export function directionFromIndex(from: number, to: number): TransitionDirection {
  if (to > from) return "forward";
  if (to < from) return "backward";
  return "sibling";
}
