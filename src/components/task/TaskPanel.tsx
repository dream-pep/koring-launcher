//  __         __     __   __     ______     __  __     ______        __   __     ______     ______
// /\ \       /\ \   /\ "-.\ \   /\  ___\   /\ \/ /    /\  ___\      /\ "-.\ \   /\  ___\   /\__  _\
// \ \ \____  \ \ \  \ \ \-.  \  \ \ \__ \  \ \  _"-.  \ \  __\      \ \ \-.  \  \ \  __\   \/_/\ \/
//  \ \_____\  \ \_\  \ \_\\"\_\  \ \_____\  \ \_\ \_\  \ \_____\     \ \_\\"\_\  \ \_____\    \ \_\
//   \/_____/   \/_/   \/_/ \/_/   \/_____/   \/_/\/_/   \/_____/      \/_/ \/_/   \/_____/     \/_/
//
// 所有权利归Lingke Network (china)所有 | dream_pep拥有其艺术改变权力
// 未经允许的情况下删除此版权头可能会受到民事指控
// 请勿在未经Lingke Network (china)允许的范围内修改代码并分发

import { useEffect, useRef, useState, type ReactNode } from "react";
import clsx from "clsx";
import {
  Inbox,
  Trash2,
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
import { Button } from "@/components/ui/button";
import { TaskCard } from "./TaskCard";

// 退场动画时长（与 duration 保持一致）
const EXIT_DURATION = 220;

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

// 分区标题（右侧可带操作）
function SectionHeader({
  title,
  tone = "muted",
  action,
}: {
  title: string;
  tone?: "muted" | "amber";
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-2.5">
      <h3
        className={clsx(
          "text-[11px] font-semibold uppercase tracking-wider",
          tone === "amber" ? "text-amber-500/70" : "text-foreground/30",
        )}
      >
        {title}
      </h3>
      {action}
    </div>
  );
}

/**
 * 任务面板：Windows 通知中心式右侧浮层。
 * 内容优先级：进行中的任务 → 系统通知 → 通知（交互历史）→ 已完成的任务。
 * - 无遮罩，点击面板外部或按 Esc 关闭
 * - 打开时从右侧滑入，关闭时滑出后再卸载
 */
export function TaskPanel() {
  const open = useTaskPanelStore((s) => s.open);
  const closePanel = useTaskPanelStore((s) => s.closePanel);

  const tasks = useTaskStore((s) => s.tasks);
  const clearHistory = useTaskStore((s) => s.clearHistory);

  const systemNotices = useNoticeStore((s) => s.systemNotices);
  const toastHistory = useNoticeStore((s) => s.toastHistory);
  const clearToasts = useNoticeStore((s) => s.clearToasts);

  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);

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

  if (!mounted) return null;

  // 任务分组
  const activeTasks = tasks.filter((t) => t.status === "pending" || t.status === "running");
  const pausedTasks = tasks.filter((t) => t.status === "paused");
  const completedTasks = tasks.filter(
    (t) => t.status === "completed" || t.status === "failed" || t.status === "cancelled",
  );

  const hasActive = activeTasks.length > 0 || pausedTasks.length > 0;
  const isEmpty =
    !hasActive && systemNotices.length === 0 && toastHistory.length === 0 && completedTasks.length === 0;

  return (
    <div
      ref={panelRef}
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
      <div className="flex-1 overflow-y-auto scroll-area px-4 py-4">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Inbox className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm">暂无内容</p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* 1. 进行中的任务（最高优先级） */}
            {activeTasks.length > 0 && (
              <section>
                <SectionHeader title="进行中" />
                <div className="space-y-2.5">
                  {activeTasks.map((t) => (
                    <TaskCard key={t.id} task={t} surface="glass" />
                  ))}
                </div>
              </section>
            )}

            {pausedTasks.length > 0 && (
              <section>
                <SectionHeader title="已暂停" tone="amber" />
                <div className="space-y-2.5">
                  {pausedTasks.map((t) => (
                    <TaskCard key={t.id} task={t} surface="glass" />
                  ))}
                </div>
              </section>
            )}

            {/* 2. 系统通知（服务端下发的全局公告） */}
            {systemNotices.length > 0 && (
              <section>
                <SectionHeader title="系统通知" />
                <div className="space-y-2.5">
                  {systemNotices.map((n) => (
                    <div key={n.id} className="notice-surface rounded-[14px] px-3.5 py-2.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={clsx(
                            "w-1.5 h-1.5 rounded-full shrink-0",
                            NOTICE_DOT[n.level] ?? "bg-sky-500",
                          )}
                        />
                        <p className="text-[13px] font-medium text-foreground flex-1 min-w-0 truncate">
                          {n.title}
                        </p>
                        {n.published_at && (
                          <span className="text-[10px] text-muted-foreground/40 shrink-0">
                            {new Date(n.published_at).toLocaleDateString("zh-CN")}
                          </span>
                        )}
                      </div>
                      {(n.publisher || n.content) && (
                        <p className="text-[12px] text-muted-foreground/80 mt-1 line-clamp-2 break-all">
                          {[n.publisher, n.content].filter(Boolean).join(" · ")}
                        </p>
                      )}
                      {n.link_url && (
                        <button
                          onClick={() => window.electronAPI?.openExternal(n.link_url as string)}
                          className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-primary hover:underline cursor-pointer"
                        >
                          <ExternalLink className="w-3 h-3" />
                          查看详情
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 3. 通知（程序交互过程中产生的 toast 历史） */}
            {toastHistory.length > 0 && (
              <section>
                <SectionHeader
                  title="通知"
                  action={
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearToasts}
                      className="h-6 px-2 text-[11px] text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-3 h-3" />
                      清空
                    </Button>
                  }
                />
                <div className="space-y-2">
                  {toastHistory.map((t) => {
                    const meta = TOAST_META[t.type];
                    const Icon = meta.icon;
                    return (
                      <div key={t.id} className="notice-surface flex items-start gap-2 rounded-[14px] px-3.5 py-2.5">
                        <Icon
                          className={clsx(
                            "w-3.5 h-3.5 mt-0.5 shrink-0",
                            meta.color,
                            meta.spin && "animate-spin",
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] text-foreground/90 break-all">{t.message}</p>
                          {t.description && (
                            <p className="text-[11px] text-muted-foreground/70 mt-0.5 break-all">
                              {t.description}
                            </p>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground/40 shrink-0 tabular-nums">
                          {formatTime(t.time)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* 4. 已完成的任务（最低优先级） */}
            {completedTasks.length > 0 && (
              <section>
                <SectionHeader
                  title="已完成"
                  action={
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearHistory}
                      className="h-6 px-2 text-[11px] text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-3 h-3" />
                      清空历史
                    </Button>
                  }
                />
                <div className="space-y-2.5">
                  {completedTasks.map((t) => (
                    <TaskCard key={t.id} task={t} surface="glass" />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
