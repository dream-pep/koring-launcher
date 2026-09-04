import { useEffect, useRef } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { onUpdateStatus } from "@/api/update";
import { useRouteStore } from "@/stores/routeStore";
import { useUpdateDialogStore } from "@/stores/updateDialogStore";
import { BUILD_MODE } from "@/lib/mode";
import { VERSION } from "@/lib/version";
import { VersionCard } from "@/components/VersionCard";

// 与 VersionCard 一致的构建模式配色（dev 橙 / beta 绿 / run 蓝），用于主按钮底色
const modeGradients: Record<string, string> = {
  dev: "linear-gradient(135deg, #F59E0B, #D97706)",
  beta: "linear-gradient(135deg, #10B981, #059669)",
  run: "linear-gradient(135deg, #3B82F6, #2563EB)",
};

/**
 * "发现新版本" 弹窗（全局，RootLayout 挂载）：
 * - 主进程检查到新版本（状态进入 available）且不在版本更新页时自动弹出
 * - 开发者工具可通过 useUpdateDialogStore.show(version) 手动唤起（用于预览）
 * - 上半部分直接复用 VersionCard（模式渐变 + Silk + Logo，随构建模式变色）
 * - 按钮：稍后更新 / 立即更新（跳转版本更新页面）
 */
export function UpdateAvailableDialog() {
  const open = useUpdateDialogStore((s) => s.open);
  const version = useUpdateDialogStore((s) => s.version);
  const hide = useUpdateDialogStore((s) => s.hide);
  const show = useUpdateDialogStore((s) => s.show);

  const prevStateRef = useRef<string>("idle");
  const currentRouteRef = useRef<string>(useRouteStore.getState().current);

  useEffect(() => {
    // 跟随路由（更新页自身不弹，避免打扰已在该页操作的用户）
    return useRouteStore.subscribe(() => {
      currentRouteRef.current = useRouteStore.getState().current;
    });
  }, []);

  useEffect(() => {
    const unsub = onUpdateStatus((status) => {
      // 仅在「进入 available」这一跳变时自动弹出（checking→available / 再次手动检查会重新触发）
      const alreadyOpen = useUpdateDialogStore.getState().open;
      if (
        status.state === "available" &&
        prevStateRef.current !== "available" &&
        currentRouteRef.current !== "update" &&
        !alreadyOpen
      ) {
        show(status.version);
      }
      prevStateRef.current = status.state;
    });
    return unsub;
  }, [show]);

  const goUpdate = () => {
    hide();
    // 等关闭动画结束后再切换路由，避免弹窗关闭与 view transition 快照抢帧导致无过渡
    window.setTimeout(() => {
      useRouteStore.getState().navigate("update");
    }, 220);
  };

  const gradient = modeGradients[BUILD_MODE] ?? modeGradients.run;
  const targetVersion = version || VERSION;

  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && hide()}>
      <AlertDialogContent
        className="gap-0 overflow-hidden rounded-2xl p-0"
        style={{ width: "min(720px, calc(100vw - 2rem))", maxWidth: "min(720px, calc(100vw - 2rem))" }}
      >
        {/* 统一内边距容器：卡片与正文共用同一水平宽度（安全区不粘连边框） */}
        <div className="flex flex-col p-2.5 sm:p-3">
          {/* 上半部分：直接复用 VersionCard（全宽；关闭共享过渡名，避免打断路由切换动画） */}
          <VersionCard noViewTransition className="w-full" />

          {/* 下半部分：与版本卡同宽的说明 + 按钮 */}
          <div className="flex flex-col gap-4 px-1 pt-4 pb-1">
            <div>
              <AlertDialogTitle className="font-heading text-base font-semibold text-foreground">
                版本更新可用
              </AlertDialogTitle>
              <AlertDialogDescription className="mt-1.5 text-[13px] leading-relaxed">
                当前版本 v{VERSION}，发现新版本 v{targetVersion}。建议尽快更新以获得最新功能与修复。
              </AlertDialogDescription>
            </div>

            <div className="flex gap-2.5">
              <button
                onClick={hide}
                className="flex-1 h-10 rounded-lg text-[13px] font-medium bg-foreground/[0.05] hover:bg-foreground/[0.1] text-foreground/70 hover:text-foreground transition-colors cursor-pointer"
              >
                稍后更新
              </button>
              <button
                onClick={goUpdate}
                className="flex-[1.4] h-10 rounded-lg text-[13px] font-semibold text-white transition-colors cursor-pointer"
                style={{ background: gradient, boxShadow: "0 2px 10px rgba(0,0,0,0.12)" }}
                onMouseEnter={(e) => (e.currentTarget.style.filter = "brightness(1.08)")}
                onMouseLeave={(e) => (e.currentTarget.style.filter = "none")}
              >
                立即更新
              </button>
            </div>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
