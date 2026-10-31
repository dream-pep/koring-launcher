//  __         __     __   __     ______     __  __     ______        __   __     ______     ______
// /\ \       /\ \   /\ "-.\ \   /\  ___\   /\ \/ /    /\  ___\      /\ "-.\ \   /\  ___\   /\__  _\
// \ \ \____  \ \ \  \ \ \-.  \  \ \ \__ \  \ \  _"-.  \ \  __\      \ \ \-.  \  \ \  __\   \/_/\ \/
//  \ \_____\  \ \_\  \ \_\\"\_\  \ \_____\  \ \_\ \_\  \ \_____\     \ \_\\"\_\  \ \_____\    \ \_\
//   \/_____/   \/_/   \/_/ \/_/   \/_____/   \/_/\/_/   \/_____/      \/_/ \/_/   \/_____/     \/_/
//
// 所有权利归Lingke Network (china)所有 | dream_pep拥有其艺术改变权力
// 未经允许的情况下删除此版权头可能会受到民事指控
// 请勿在未经Lingke Network (china)允许的范围内修改代码并分发

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import clsx from "clsx";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import {
  Inbox,
  Trash2,
  ChevronDown,
  CheckCircle2,
  Info,
  AlertTriangle,
  XCircle,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { useTaskStore } from "@/stores/taskStore";
import { useTaskPanelStore } from "@/stores/taskPanelStore";
import { useNoticeStore, type ToastRecord } from "@/stores/noticeStore";
import type { LauncherNotification } from "@/api/launcher-api";
import { useA11yStore } from "@/stores/a11yStore";
import { Button } from "@/components/ui/button";
import { TaskCard } from "./TaskCard";

// 退场动画时长（与 duration 保持一致）
const EXIT_DURATION = 220;

// 与 index.css 的 --ease-spring-soft / --ease-ios 保持一致，供 motion 复用
const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];
const EASE_IN: [number, number, number, number] = [0.4, 0, 1, 1];

// 列表项：进入时上浮淡入，退出时向右滑出；布局变化（如清空后补位）用 position 动画
const itemTransition = {
  duration: 0.26,
  ease: EASE_OUT,
  layout: { duration: 0.22, ease: EASE_OUT },
};

const exitTransition = { duration: 0.16, ease: EASE_IN };

// 分区/空态整体进出场
const blockTransition = { duration: 0.22, ease: EASE_OUT };

// 系统通知级别 → 色点
const NOTICE_DOT: Record<string, string> = {
  danger: "bg-red-500",
  vulnerability: "bg-red-500",
  warning: "bg-amber-500",
  info: "bg-sky-500",
  event: "bg-violet-500",
};

// 交互通知类型 → 图标与颜色
const TOAST_META: Record<
  ToastRecord["type"],
  { icon: typeof CheckCircle2; color: string; spin?: boolean }
> = {
  success: { icon: CheckCircle2, color: "text-green-500" },
  info: { icon: Info, color: "text-sky-500" },
  warning: { icon: AlertTriangle, color: "text-amber-500" },
  error: { icon: XCircle, color: "text-red-500" },
  loading: { icon: Loader2, color: "text-muted-foreground", spin: true },
  default: { icon: Info, color: "text-primary" },
};

// 时间格式：HH:MM
function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

// 分区标题（右侧可带数量徽标）
function SectionHeader({
  title,
  tone = "muted",
  count,
}: {
  title: string;
  tone?: "muted" | "amber";
  count?: number;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <h3
        className={clsx(
          "text-[11px] font-semibold uppercase tracking-wider",
          tone === "amber" ? "text-amber-500/70" : "text-foreground/30",
        )}
      >
        {title}
      </h3>
      {count !== undefined && count > 0 && (
        <span className="rounded-full bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground/50">
          {count}
        </span>
      )}
    </div>
  );
}

/**
 * 列表项进出场包装：
 * - 新条目（新通知 / 新任务）从下方轻微上浮淡入
 * - 清空 / 移除时向右滑出淡出（AnimatePresence 负责保留 DOM 直到退出完成）
 * - layout="position" 让剩余条目在补位时平滑移动，而不是瞬间跳一格
 */
function AnimatedItem({ children, index = 0 }: { children: ReactNode; index?: number }) {
  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 10, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 26, scale: 0.98, transition: exitTransition }}
      transition={{ ...itemTransition, delay: Math.min(index * 0.03, 0.15) }}
    >
      {children}
    </motion.div>
  );
}

// 系统通知卡片
function NoticeRow({ notice }: { notice: LauncherNotification }) {
  return (
    <div className="notice-surface rounded-[14px] px-3.5 py-2.5">
      <div className="flex items-center gap-2">
        <span
          className={clsx(
            "w-1.5 h-1.5 rounded-full shrink-0",
            NOTICE_DOT[notice.level] ?? "bg-sky-500",
          )}
        />
        <p className="text-[13px] font-medium text-foreground flex-1 min-w-0 truncate">
          {notice.title}
        </p>
        {notice.published_at && (
          <span className="text-[10px] text-muted-foreground/40 shrink-0">
            {new Date(notice.published_at).toLocaleDateString("zh-CN")}
          </span>
        )}
      </div>
      {(notice.publisher || notice.content) && (
        <p className="text-[12px] text-muted-foreground/80 mt-1 line-clamp-2 break-all">
          {[notice.publisher, notice.content].filter(Boolean).join(" · ")}
        </p>
      )}
      {notice.link_url && (
        <button
          type="button"
          onClick={() => window.electronAPI?.openExternal(notice.link_url as string)}
          className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-primary hover:underline cursor-pointer"
        >
          <ExternalLink className="w-3 h-3" />
          查看详情
        </button>
      )}
    </div>
  );
}

// 交互通知（toast 历史）卡片
function ToastRow({ toast }: { toast: ToastRecord }) {
  const meta = TOAST_META[toast.type];
  const Icon = meta.icon;
  return (
    <div className="notice-surface flex items-start gap-2 rounded-[14px] px-3.5 py-2.5">
      <Icon
        className={clsx("w-3.5 h-3.5 mt-0.5 shrink-0", meta.color, meta.spin && "animate-spin")}
      />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] text-foreground/90 break-all">{toast.message}</p>
        {toast.description && (
          <p className="text-[11px] text-muted-foreground/70 mt-0.5 break-all">
            {toast.description}
          </p>
        )}
      </div>
      <span className="text-[10px] text-muted-foreground/40 shrink-0 tabular-nums">
        {formatTime(toast.time)}
      </span>
    </div>
  );
}

/**
 * 任务面板：Windows 通知中心式右侧浮层。
 * 内容优先级：进行中的任务 → 系统通知 → 通知（交互历史）→ 历史任务（默认折叠）。
 * - 无遮罩，点击面板外部或按 Esc 关闭
 * - 打开时从右侧滑入，关闭时滑出后再卸载
 * - 新条目入场动画；清空通知 / 历史任务时条目滑出后再消失
 */
export function TaskPanel() {
  const open = useTaskPanelStore((s) => s.open);
  const closePanel = useTaskPanelStore((s) => s.closePanel);
  const reduceMotion = useA11yStore((s) => s.reduceMotion);

  const tasks = useTaskStore((s) => s.tasks);
  const clearHistory = useTaskStore((s) => s.clearHistory);

  const systemNotices = useNoticeStore((s) => s.systemNotices);
  const toastHistory = useNoticeStore((s) => s.toastHistory);
  const clearToasts = useNoticeStore((s) => s.clearToasts);

  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  // 历史任务记录默认折叠；每次打开面板都回到折叠态
  const [historyOpen, setHistoryOpen] = useState(false);

  // 挂载 / 进出场动画：打开时等两帧（确保初始位移已绘制）再滑入；关闭时先滑出再卸载
  useEffect(() => {
    if (open) {
      setMounted(true);
      let inner = 0;
      const outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(() => setVisible(true));
      });
      return () => {
        cancelAnimationFrame(outer);
        cancelAnimationFrame(inner);
      };
    }
    if (!mounted) return;
    setVisible(false);
    const timer = window.setTimeout(() => setMounted(false), EXIT_DURATION);
    return () => window.clearTimeout(timer);
  }, [open, mounted]);

  // 每次重新打开面板，历史任务恢复到默认折叠
  useEffect(() => {
    if (open) setHistoryOpen(false);
  }, [open]);

  // 历史任务被清空后复位折叠态，避免下次出现历史记录时自动展开
  const hasCompletedTasks = tasks.some(
    (t) => t.status === "completed" || t.status === "failed" || t.status === "cancelled",
  );
  useEffect(() => {
    if (!hasCompletedTasks) setHistoryOpen(false);
  }, [hasCompletedTasks]);

  // 关闭交互：点击面板外部 / 按 Esc
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      // 面板内部点击不关闭
      if (panelRef.current?.contains(target)) return;
      // 顶栏任务按钮由自身 toggle 处理，避免「关闭 → 再次打开」的竞态
      if (target.closest("[data-task-panel-trigger]")) return;
      closePanel();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePanel();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, closePanel]);

  // 清空：通知历史 + 历史任务（进行中 / 已暂停 / 系统公告保留）。
  // 条目会先播放滑出动画，AnimatePresence 播完后才真正从视图移除。
  const handleClearAll = useCallback(() => {
    clearToasts();
    clearHistory();
  }, [clearToasts, clearHistory]);

  if (!mounted) return null;

  // 任务分组
  const activeTasks = tasks.filter((t) => t.status === "pending" || t.status === "running");
  const pausedTasks = tasks.filter((t) => t.status === "paused");
  const completedTasks = tasks.filter(
    (t) => t.status === "completed" || t.status === "failed" || t.status === "cancelled",
  );

  const hasClearable = toastHistory.length > 0 || completedTasks.length > 0;
  const isEmpty =
    activeTasks.length === 0 &&
    pausedTasks.length === 0 &&
    systemNotices.length === 0 &&
    toastHistory.length === 0 &&
    completedTasks.length === 0;

  return (
    <MotionConfig reducedMotion={reduceMotion ? "always" : "never"}>
      <div
        ref={panelRef}
        role="region"
        aria-label="通知中心"
        className={clsx(
          // 圆角卡片浮起：四周留出间距，不贴边
          "fixed right-4 top-[52px] bottom-4 w-[380px] z-[90] flex flex-col overflow-hidden",
          "rounded-2xl",
          // 与启动游戏按钮一致的模糊磨砂背景（blur 值很小，配合 will-change 不拖慢动画）
          "bg-background/60 backdrop-blur-[5px]",
          "border border-[color:var(--titlebar-border)]",
          "shadow-lg shadow-black/5 dark:shadow-black/20",
          // 提升为独立合成层，保证 transform 动画走 GPU 合成
          "will-change-transform",
          "transition-transform duration-[220ms] ease-spring-soft",
          visible ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* 面板头部：固定不滚动 */}
        <header className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-[color:var(--titlebar-border)] px-4">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="text-[13px] font-semibold text-foreground/80">通知中心</h2>
            <AnimatePresence initial={false}>
              {activeTasks.length > 0 && (
                <motion.span
                  key="active-badge"
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                  transition={blockTransition}
                  className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-primary"
                >
                  {activeTasks.length} 进行中
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          <AnimatePresence initial={false}>
            {hasClearable && (
              <motion.div
                key="clear"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={blockTransition}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearAll}
                  title="清空通知与历史任务"
                  className="h-6 gap-1 px-2 text-[11px] text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-3 h-3" />
                  清空
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </header>

        {/* 内容区：所有分区块统一走 AnimatePresence，条目退出动画播完再移除 */}
        <div className="relative flex-1 overflow-y-auto scroll-area">
          <div className="px-4 py-4">
            <div className="flex flex-col gap-5">
              <AnimatePresence initial={false}>
                {/* 1. 进行中的任务（最高优先级） */}
                {activeTasks.length > 0 && (
                  <motion.section
                    key="active"
                    layout="position"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8, transition: exitTransition }}
                    transition={blockTransition}
                    className="flex flex-col gap-2.5"
                  >
                    <SectionHeader title="进行中" count={activeTasks.length} />
                    <AnimatePresence initial={false}>
                      {activeTasks.map((t, i) => (
                        <AnimatedItem key={t.id} index={i}>
                          <TaskCard task={t} surface="glass" />
                        </AnimatedItem>
                      ))}
                    </AnimatePresence>
                  </motion.section>
                )}

                {/* 已暂停 */}
                {pausedTasks.length > 0 && (
                  <motion.section
                    key="paused"
                    layout="position"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8, transition: exitTransition }}
                    transition={blockTransition}
                    className="flex flex-col gap-2.5"
                  >
                    <SectionHeader title="已暂停" tone="amber" count={pausedTasks.length} />
                    <AnimatePresence initial={false}>
                      {pausedTasks.map((t, i) => (
                        <AnimatedItem key={t.id} index={i}>
                          <TaskCard task={t} surface="glass" />
                        </AnimatedItem>
                      ))}
                    </AnimatePresence>
                  </motion.section>
                )}

                {/* 2. 系统通知（服务端下发的全局公告） */}
                {systemNotices.length > 0 && (
                  <motion.section
                    key="notices"
                    layout="position"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8, transition: exitTransition }}
                    transition={blockTransition}
                    className="flex flex-col gap-2.5"
                  >
                    <SectionHeader title="Koring News" count={systemNotices.length} />
                    <AnimatePresence initial={false}>
                      {systemNotices.map((n, i) => (
                        <AnimatedItem key={n.id} index={i}>
                          <NoticeRow notice={n} />
                        </AnimatedItem>
                      ))}
                    </AnimatePresence>
                  </motion.section>
                )}

                {/* 3. 通知（程序交互过程中产生的 toast 历史） */}
                {toastHistory.length > 0 && (
                  <motion.section
                    key="toasts"
                    layout="position"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8, transition: exitTransition }}
                    transition={blockTransition}
                    className="flex flex-col gap-2.5"
                  >
                    <SectionHeader title="通知" count={toastHistory.length} />
                    <AnimatePresence initial={false}>
                      {toastHistory.map((t, i) => (
                        <AnimatedItem key={t.id} index={i}>
                          <ToastRow toast={t} />
                        </AnimatedItem>
                      ))}
                    </AnimatePresence>
                  </motion.section>
                )}

                {/* 4. 历史任务（最低优先级，默认折叠） */}
                {completedTasks.length > 0 && (
                  <motion.section
                    key="history"
                    layout="position"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8, transition: exitTransition }}
                    transition={blockTransition}
                    className="flex flex-col gap-2.5"
                  >
                    <button
                      type="button"
                      onClick={() => setHistoryOpen((v) => !v)}
                      aria-expanded={historyOpen}
                      className="group flex w-full items-center justify-between gap-2 text-left cursor-pointer"
                    >
                      <span className="flex min-w-0 items-center gap-1.5">
                        <ChevronDown
                          className={clsx(
                            "w-3 h-3 shrink-0 text-muted-foreground/50 transition-transform duration-200 ease-spring-soft",
                            historyOpen && "rotate-180",
                          )}
                        />
                        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-foreground/30">
                          历史任务
                        </h3>
                        <span className="rounded-full bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground/50">
                          {completedTasks.length}
                        </span>
                      </span>
                      <span className="shrink-0 text-[10px] text-muted-foreground/30 transition-colors group-hover:text-muted-foreground/60">
                        {historyOpen ? "收起" : "展开"}
                      </span>
                    </button>

                    <AnimatePresence initial={false}>
                      {historyOpen && (
                        <motion.div
                          key="history-list"
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          transition={blockTransition}
                          className="flex flex-col gap-2.5"
                        >
                          <AnimatePresence initial={false}>
                            {completedTasks.map((t, i) => (
                              <AnimatedItem key={t.id} index={i}>
                                <TaskCard task={t} surface="glass" />
                              </AnimatedItem>
                            ))}
                          </AnimatePresence>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.section>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* 空态：绝对居中，避免与正在退场的分区叠在一起造成高度跳动 */}
          <AnimatePresence initial={false}>
            {isEmpty && (
              <motion.div
                key="empty"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={blockTransition}
                className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-muted-foreground"
              >
                <Inbox className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm">暂无内容</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </MotionConfig>
  );
}
