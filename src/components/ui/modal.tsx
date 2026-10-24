import * as React from "react"
import { createPortal } from "react-dom"

import { cn } from "@/lib/utils"
import { originStyleFor } from "@/lib/pointer-origin"

/** 退场动画时长（pop-out 180ms / overlay-out 160ms，留少量余量后卸载） */
const EXIT_DURATION = 200

interface ModalProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  /** 面板额外 class（宽度、圆角等），与默认面板样式合并 */
  className?: string
  /** 面板 aria-labelledby 指向的标题元素 id */
  labelledBy?: string
  /** 点击遮罩是否关闭，默认 true */
  closeOnBackdrop?: boolean
  /** Esc 是否关闭，默认 true */
  closeOnEscape?: boolean
}

/**
 * 通用模态弹层（portal 到 body）：
 *
 * - 遮罩 `animate-overlay-in/out`（淡入淡出），面板 `animate-pop-in/out`（spring 进场、反向退场）；
 * - 面板带 `origin-pointer`，挂载当帧用 `originStyleFor` 按最近指针位置写 --origin-x/--origin-y，
 *   弹层「从触发位置长出来」；
 * - 退场动画播完（~200ms）后再卸载，避免关闭时硬切；
 * - 支持 Esc 关闭 / 点击遮罩关闭，均可按需关闭（例如提交中禁止关闭）。
 */
export function Modal({
  open,
  onClose,
  children,
  className,
  labelledBy,
  closeOnBackdrop = true,
  closeOnEscape = true,
}: ModalProps) {
  const [mounted, setMounted] = React.useState(open)
  const [state, setState] = React.useState<"open" | "closed">(open ? "open" : "closed")
  const panelRef = React.useRef<HTMLDivElement>(null)
  const originElementRef = React.useRef<HTMLDivElement | null>(null)

  // open → 挂载并进场；close → 标记退场，动画播完再卸载
  React.useEffect(() => {
    if (open) {
      setState("open")
      setMounted(true)
      return
    }
    if (!mounted) return
    setState("closed")
    const timer = window.setTimeout(() => setMounted(false), EXIT_DURATION)
    return () => window.clearTimeout(timer)
  }, [open, mounted])

  // Esc 关闭
  React.useEffect(() => {
    if (!open || !closeOnEscape) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.stopPropagation()
      onClose()
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [open, closeOnEscape, onClose])

  // 面板每次挂载时按最近指针位置算一次 origin（进场与退场共用同一个 origin）
  React.useLayoutEffect(() => {
    const element = panelRef.current
    if (!element || originElementRef.current === element) return
    originElementRef.current = element
    const origin = originStyleFor(element) as Record<string, string>
    element.style.setProperty("--origin-x", origin["--origin-x"] ?? "50%")
    element.style.setProperty("--origin-y", origin["--origin-y"] ?? "50%")
  })

  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div
        aria-hidden
        data-state={state}
        onClick={closeOnBackdrop ? onClose : undefined}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm data-[state=open]:animate-overlay-in data-[state=closed]:animate-overlay-out"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        data-state={state}
        onAnimationEnd={(event) => {
          if (event.target === event.currentTarget && state === "closed") setMounted(false)
        }}
        className={cn(
          "origin-pointer relative z-10 max-h-[calc(100dvh-2rem)] w-full overflow-y-auto scroll-area rounded-2xl border border-border/50 bg-background shadow-2xl dark:border-white/[0.08] data-[state=open]:animate-pop-in data-[state=closed]:animate-pop-out",
          className
        )}
      >
        {children}
      </div>
    </div>,
    document.body
  )
}
