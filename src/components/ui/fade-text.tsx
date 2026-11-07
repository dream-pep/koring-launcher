import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FadeTextProps {
  /** 文本值；变化时旧文字淡出、新文字淡入 */
  value: ReactNode;
  className?: string;
}

/** 旧文字淡出时长（ms）；到点后换值并淡入 */
const OUT_MS = 130;

/**
 * 原地更新的文字：内容变化时做「渐出 → 渐入」，而不是直接闪烁替换。
 *
 * 适用于版本号、状态文案、实例名、路径等偶尔变化的文本；
 * 高频数值（下载百分比）不要用它，否则每帧都会触发淡出。
 */
export function FadeText({ value, className }: FadeTextProps) {
  const [display, setDisplay] = useState(value);
  const [phase, setPhase] = useState<"idle" | "out" | "in">("idle");
  const firstRef = useRef(true);
  const prevRef = useRef(value);
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (firstRef.current) {
      firstRef.current = false;
      prevRef.current = value;
      return;
    }
    if (Object.is(prevRef.current, value)) return;
    prevRef.current = value;

    // 减少动画（系统偏好或启动器「辅助功能 → 减少动画」）：直接换值，不做淡出等待
    if (
      typeof window !== "undefined" &&
      (window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
        !!document.querySelector(".reduce-motion"))
    ) {
      setDisplay(value);
      setPhase("idle");
      return;
    }

    setPhase("out");
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setDisplay(value);
      setPhase("in");
    }, OUT_MS);

    return () => window.clearTimeout(timerRef.current);
  }, [value]);

  return (
    <span
      className={cn("fade-text", className)}
      data-phase={phase === "idle" ? undefined : phase}
    >
      {display}
    </span>
  );
}
