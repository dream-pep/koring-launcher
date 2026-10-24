/**
 * 记录最近一次指针按下位置，用于弹层「从触发位置长出来」的 transform-origin。
 *
 * 不依赖具体触发元素引用（很多弹窗是 store 驱动的，没有可用的 trigger ref），
 * 只记录视口坐标；弹层打开时用自身 rect 把该坐标换算成元素内百分比。
 */

interface PointerPoint {
  x: number;
  y: number;
}

let lastPointer: PointerPoint | null = null;
let installed = false;

export function installPointerOrigin() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener(
    "pointerdown",
    (event) => {
      lastPointer = { x: event.clientX, y: event.clientY };
    },
    { capture: true, passive: true },
  );
}

export function getPointerOrigin(): PointerPoint | null {
  return lastPointer;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/**
 * 计算元素相对指针位置的 transform-origin 百分比。
 * 指针不在元素附近时夹到 8%–92%，避免 origin 贴边导致动画被裁切感太强。
 */
export function originStyleFor(element: HTMLElement): React.CSSProperties {
  const rect = element.getBoundingClientRect();
  const pointer = getPointerOrigin();
  if (!pointer || rect.width === 0 || rect.height === 0) {
    return { "--origin-x": "50%", "--origin-y": "50%" } as React.CSSProperties;
  }
  const x = clamp(((pointer.x - rect.left) / rect.width) * 100, 8, 92);
  const y = clamp(((pointer.y - rect.top) / rect.height) * 100, 8, 92);
  return {
    "--origin-x": `${x.toFixed(1)}%`,
    "--origin-y": `${y.toFixed(1)}%`,
  } as React.CSSProperties;
}
