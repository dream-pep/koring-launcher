import { useEffect, useRef } from "react";
import { Button } from "@heroui/react";
import { AlertCircle, Lightbulb, Loader2, RotateCcw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useConfigStore } from "@/stores/configStore";
import { useKoringAuthStore } from "@/stores/koringAuthStore";
import { useRouteStore } from "@/stores/routeStore";
import { useTerracottaStore } from "@/stores/terracottaStore";

/** 与联机页/设置页一致的卡片外观 */
const SURFACE_CLS =
  "rounded-xl border border-black/[0.06] bg-white/85 shadow-sm backdrop-blur-[12px] dark:border-white/[0.07] dark:bg-black/45";

/** exception 类型 → 面向用户的说明（上游 v0.4.2） */
const EXCEPTION_TEXT: Record<number, string> = {
  0: "无法连接房主，房间可能已关闭。",
  1: "与房主的连接中断。",
  2: "加入方 EasyTier 崩溃。",
  3: "房主 EasyTier 崩溃。",
  4: "房主的游戏服务器已失联。",
  5: "脚手架协议错误。",
};

/**
 * 创建房间子页：进入后自动开始匹配「已开启联机」的实例
 * （游戏内点「对局域网开放」后，陶瓦会自动识别并开房）。
 * 匹配成功后返回联机主页，由主页卡片展示「房间已开启」。
 */
export function CreateRoom() {
  const navigate = useRouteStore((s) => s.navigate);
  const status = useTerracottaStore((s) => s.status);
  const init = useTerracottaStore((s) => s.init);
  const host = useTerracottaStore((s) => s.host);
  const start = useTerracottaStore((s) => s.start);
  const reset = useTerracottaStore((s) => s.reset);
  const pendingReset = useTerracottaStore((s) => s.pending.reset);
  const savedName = useKoringAuthStore((s) => s.user?.username ?? "");
  const publicNodes = useConfigStore((s) => s.config.network.terracotta?.publicNodes ?? []);

  const installed = status.binary.installed;
  const phase = status.phase;
  const state = status.snapshot.state;
  const roomCode = status.snapshot.room;
  const exceptionType = status.snapshot.exceptionType;
  const errorText = status.snapshot.error;

  /** 只在本次进入页面内触发一次「启动服务 / 开始匹配」 */
  const startRequestedRef = useRef(false);
  const hostRequestedRef = useRef(false);
  /**
   * 记住已经分配过的邀请码：重试时通过 /state/scanning 的 room 参数沿用同一个码，
   * 这样之前分享出去的链接不会失效（上游支持「指定房间码重新开房」）。
   */
  const lastRoomRef = useRef("");

  // 订阅主进程状态事件（离开联机主页后订阅会被卸载，这里重新挂上）
  useEffect(() => init(), [init]);

  // 记录本次分配到的邀请码，供重试复用
  useEffect(() => {
    if ((state === "host-starting" || state === "host-ok") && roomCode) lastRoomRef.current = roomCode;
  }, [state, roomCode]);

  // 匹配成功：回到联机主页（主页卡片会变成「房间已开启」）
  useEffect(() => {
    if (state === "host-ok") navigate("play-link");
  }, [state, navigate]);

  // 自动准备服务并开始匹配
  useEffect(() => {
    if (!installed) return;

    if (phase === "stopped") {
      if (startRequestedRef.current) return;
      startRequestedRef.current = true;
      void start(savedName.trim() || undefined);
      return;
    }

    if (phase !== "running") return;
    if (state !== "waiting") return;
    if (hostRequestedRef.current) return;
    hostRequestedRef.current = true;
    void host(savedName.trim() || undefined, publicNodes, lastRoomRef.current || undefined);
  }, [installed, phase, state, start, host, savedName, publicNodes]);

  const handleCancel = () => {
    // 取消匹配：把上游状态机复位（host-scanning → waiting），再回主页
    void reset();
    navigate("play-link");
  };

  const handleRetry = () => {
    // 复位后状态回到 waiting，上面的 effect 会自动重新开始匹配
    hostRequestedRef.current = false;
    void reset();
  };

  const exceptionMessage = EXCEPTION_TEXT[exceptionType] ?? "";
  const failed = state === "exception";
  const waitingService = installed && (phase === "starting" || (phase === "running" && state === "waiting"));

  return (
    <div className="grid h-full place-items-center p-6">
      <div className={cn(SURFACE_CLS, "flex w-full max-w-[520px] flex-col gap-6 p-8")}>
        {!installed ? (
          <>
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 text-warning" />
              <h2 className="text-[20px] font-bold leading-tight text-foreground">
                陶瓦联机尚未安装
              </h2>
            </div>
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              请先到「设置 → 陶瓦联机」下载并安装联机程序，安装完成后即可创建房间。
            </p>
            <div className="flex justify-end">
              <Button variant="outline" onPress={() => navigate("setting")}>
                前往设置
              </Button>
            </div>
          </>
        ) : failed ? (
          <>
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 text-danger" />
              <h2 className="text-[20px] font-bold leading-tight text-foreground">
                创建房间失败
              </h2>
            </div>
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              {errorText || exceptionMessage || "联机服务返回了未知错误，请重试。"}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onPress={handleCancel} isDisabled={pendingReset}>
                返回
              </Button>
              <Button variant="primary" onPress={handleRetry} isDisabled={pendingReset}>
                {pendingReset ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RotateCcw className="w-4 h-4" />
                )}
                重试
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start gap-3">
              <Loader2 className="mt-0.5 w-5 h-5 shrink-0 animate-spin text-primary" />
              <div className="min-w-0">
                <h2 className="text-[20px] font-bold leading-tight text-foreground">
                  正在匹配已开启联机的实例
                </h2>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                  {phase === "starting"
                    ? "正在启动联机服务…"
                    : waitingService
                      ? "正在扫描局域网中的游戏房间…"
                      : "正在等待游戏内开启「对局域网开放」…"}
                </p>
              </div>
            </div>

            {/* TIP */}
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/25 bg-amber-500/[0.08] px-3.5 py-3">
              <Lightbulb className="mt-0.5 w-4 h-4 shrink-0 text-amber-500" />
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-amber-600 dark:text-amber-400">
                  TIP
                </p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                  您可以打开游戏并点击「对局域网开放」，我们会自己识别并开启房间。
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                匹配中…
              </span>
              <Button
                variant="outline"
                onPress={handleCancel}
                isDisabled={pendingReset}
                className="shrink-0"
              >
                {pendingReset ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <X className="w-4 h-4" />
                )}
                取消
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
