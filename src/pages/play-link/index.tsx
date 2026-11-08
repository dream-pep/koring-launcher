import { useEffect, useRef, useState } from "react";
import { Button } from "@heroui/react";
import { AlertCircle, Loader2, RotateCcw, X } from "lucide-react";
import {
  EMPTY_TERRACOTTA_STATUS,
  formatRoomCodeInput,
  roomCodePayload,
  validateRoomCode,
} from "@/api/terracotta";
import { toast } from "@/lib/toast";
import { useConfigStore } from "@/stores/configStore";
import { useDeepLinkStore } from "@/stores/deepLinkStore";
import { useJoinHistoryStore } from "@/stores/joinHistoryStore";
import { useKoringAuthStore } from "@/stores/koringAuthStore";
import { useTerracottaStore } from "@/stores/terracottaStore";
import { cn } from "@/lib/utils";
import { LoginRequiredBanner } from "./LoginRequiredBanner";
import { useRoomChime } from "./useRoomChime";
import { WaitingPanels } from "./WaitingPanels";

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

/** 上游 NAT 打洞难度 → 中文（guest-starting 时展示） */
const DIFFICULTY_TEXT: Record<string, string> = {
  UNKNOWN: "未知",
  EASIEST: "极低",
  SIMPLE: "较低",
  MEDIUM: "中等",
  TOUGH: "较高",
};

/** 过渡状态文案（上游状态机里不属于「双卡视图」的那些） */
const TRANSITION_TEXT: Record<string, string> = {
  "host-scanning": "正在扫描局域网中的游戏房间…",
  "host-starting": "正在创建房间…",
  "guest-connecting": "正在加入房间…",
  "guest-starting": "正在连接房间…",
};

/**
 * 双卡视图之外的最小状态提示：
 * 只在「组件准备 / 服务启动 / 服务停止 / 异常 / 过渡状态」时出现，不另设整套状态卡。
 *
 * 兜底原则：**任何会「卡住」的状态都必须能退出**——
 * 过渡态（扫描 / 建房 / 加入 / 连接）给「取消」，超时后再补「重启服务」；
 * 异常态给「返回」；崩溃/停止给「重新启动」。
 */
const STUCK_HINT_MS = 30_000;

function StatusNotice() {
  const status = useTerracottaStore((s) => s.status);
  const pending = useTerracottaStore((s) => s.pending);
  const start = useTerracottaStore((s) => s.start);
  const stop = useTerracottaStore((s) => s.stop);
  const reset = useTerracottaStore((s) => s.reset);

  const { phase, binary, snapshot } = status;

  const transitionLabel = TRANSITION_TEXT[snapshot.state] ?? "";
  const isTransition =
    phase === "running" &&
    (snapshot.state === "host-scanning" ||
      snapshot.state === "host-starting" ||
      snapshot.state === "guest-connecting" ||
      snapshot.state === "guest-starting");

  // 状态/cd 变化时重置计时，用于「卡住太久」的兜底提示
  const stateKey = `${phase}:${snapshot.state}:${snapshot.index}`;
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    setElapsed(0);
    if (!isTransition && phase !== "starting") return;
    const startedAt = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [stateKey, isTransition, phase, binary.installed]);

  let title = transitionLabel || "正在同步联机状态…";
  let description = "";
  let primaryAction: { label: string; onPress: () => void } | null = null;
  let secondaryAction: { label: string; onPress: () => void } | null = null;

  if (!binary.installed) {
    title = "正在准备陶瓦联机组件";
    description = "首次使用时需要自动准备联机组件，通常十几秒内完成。";
    // 安装由主进程串行执行，这里不提供重复触发的入口，只显示进度
  } else if (phase === "starting") {
    title = "正在启动联机服务";
    description = "马上就好，请稍等…";
    secondaryAction = { label: "重启服务", onPress: () => void stop().then(() => start()) };
  } else if (phase === "crashed") {
    title = "联机服务已停止";
    description = "服务意外退出，可以重新启动后再试。";
    primaryAction = { label: "重新启动", onPress: () => void start() };
  } else if (phase === "stopped") {
    title = "联机服务未运行";
    description = "启动后即可创建或加入房间。";
    primaryAction = { label: "启动联机服务", onPress: () => void start() };
  } else if (snapshot.state === "exception") {
    title = "联机出现异常";
    description = EXCEPTION_TEXT[snapshot.exceptionType] ?? "房间连接中出现问题，请重试。";
    primaryAction = { label: "返回", onPress: () => void reset() };
  } else if (isTransition) {
    description =
      snapshot.state === "host-scanning"
        ? "请在游戏里点「对局域网开放」，我们会自动识别并创建房间。"
        : "正在与房主建立 P2P 连接，通常几秒到几十秒。";
    // 加入方：上游会给出 NAT 打洞难度，难度越高越慢，提前告知避免用户以为卡死
    const difficultyText = DIFFICULTY_TEXT[snapshot.difficulty?.toUpperCase?.() ?? ""];
    if (snapshot.state === "guest-starting" && difficultyText) {
      description += `当前网络打洞难度：${difficultyText}。`;
    }
    // 加入失败后会自动切换公共节点重试，进度告诉用户，避免误以为卡住
    const attempt = status.joinAttempt;
    if (attempt && attempt.total > 1) {
      description += `正在尝试第 ${attempt.current}/${attempt.total} 组公共节点…`;
    }
    // 过渡态一律可取消：reset 会把上游状态机拉回 waiting
    primaryAction = { label: "取消", onPress: () => void reset() };
    secondaryAction = { label: "重启服务", onPress: () => void stop().then(() => start()) };
  }

  const busy = pending.start || pending.stop || pending.reset;
  const stuck = elapsed >= STUCK_HINT_MS / 1000;

  return (
    <div className={cn("w-full max-w-md p-6", SURFACE_CLS)}>
      <div className="flex items-start gap-3">
        {primaryAction ? (
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        ) : (
          <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-foreground">{title}</p>
          {description ? (
            <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
          {stuck && (isTransition || phase === "starting") ? (
            <p className="mt-2 text-[12px] leading-relaxed text-amber-600 dark:text-amber-400">
              已经等了 {elapsed} 秒，看起来没反应。可以点「取消」退出，或者「重启服务」再试。
            </p>
          ) : null}
        </div>
      </div>
      {primaryAction || secondaryAction ? (
        <div className="mt-4 flex justify-end gap-2">
          {secondaryAction ? (
            <Button
              size="sm"
              variant="ghost"
              onPress={secondaryAction.onPress}
              isDisabled={busy}
              className="gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {secondaryAction.label}
            </Button>
          ) : null}
          {primaryAction ? (
            <Button size="sm" variant="outline" onPress={primaryAction.onPress} isDisabled={busy}>
              {primaryAction.label}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function PlayLink() {
  const status = useTerracottaStore((s) => s.status);
  const loaded = useTerracottaStore((s) => s.loaded);
  const error = useTerracottaStore((s) => s.error);
  const clearError = useTerracottaStore((s) => s.clearError);
  const init = useTerracottaStore((s) => s.init);
  const start = useTerracottaStore((s) => s.start);
  const guest = useTerracottaStore((s) => s.guest);
  const setError = useTerracottaStore((s) => s.setError);
  // 联机服务要求登录 Koring Account（显示名也取自账号用户名）
  const loggedIn = useKoringAuthStore((s) => Boolean(s.user));
  const koringName = useKoringAuthStore((s) => s.user?.username ?? "");
  const publicNodes = useConfigStore((s) => s.config.network.terracotta?.publicNodes ?? []);
  // koring:// 深链带来的加入请求（浏览器点链接 → 唤醒启动器）
  const pendingJoin = useDeepLinkStore((s) => s.pending);
  const consumeRoomJoin = useDeepLinkStore((s) => s.consumeRoomJoin);
  const recordJoinHistory = useJoinHistoryStore((s) => s.record);
  // 同一房间只记录一次（轮询会不断刷新 profiles，避免重复写入）
  const recordedRoomRef = useRef<string>("");

  // 订阅主进程状态事件，卸载时退订（服务本身保持运行）
  useEffect(() => init(), [init]);

  const phase = status.phase || EMPTY_TERRACOTTA_STATUS.phase;
  const snapshot = status.snapshot || EMPTY_TERRACOTTA_STATUS.snapshot;

  // 成功加入房间后写入「历史加入过的房间」（房间码 + 房主 + 时间）
  useEffect(() => {
    if (snapshot.state !== "guest-ok" || !snapshot.room) {
      if (snapshot.state === "waiting") recordedRoomRef.current = "";
      return;
    }
    const code = formatRoomCodeInput(`U/${roomCodePayload(snapshot.room)}`);
    if (!code || recordedRoomRef.current === code) return;
    recordedRoomRef.current = code;
    const hostName = snapshot.profiles?.find((profile) => profile.kind === "HOST")?.name ?? "";
    recordJoinHistory({ code, hostName });
  }, [snapshot.state, snapshot.room, snapshot.profiles, recordJoinHistory]);

  // 房间成员进出提示音（加入 do-空 0.5s-re-mi，退出 mi-re-do）
  useRoomChime(
    snapshot.profiles,
    snapshot.state === "host-ok" || snapshot.state === "guest-ok",
  );

  // 深链自动加入：等账号/组件/服务就绪后，用房间码直接加入
  // - 已在房间中（房主/访客/连接中）：不重复加入，同房间静默提示、其它房间提示忽略
  // - 未登录、未安装、启动中时保持 pending，条件满足后自动继续
  useEffect(() => {
    if (!pendingJoin) return;

    const inRoom =
      snapshot.state === "host-ok" ||
      snapshot.state === "guest-ok" ||
      snapshot.state === "guest-connecting" ||
      snapshot.state === "guest-starting";
    if (inRoom) {
      const sameRoom =
        !!snapshot.room && roomCodePayload(snapshot.room) === roomCodePayload(pendingJoin.code);
      consumeRoomJoin();
      toast.info(sameRoom ? "您已在该房间中" : "当前已有联机房间，已忽略新的邀请");
      return;
    }

    if (!loaded || !loggedIn) return;
    if (!status.binary.installed) return;
    if (phase === "stopped") {
      void start(koringName || undefined);
      return;
    }
    if (phase !== "running" || snapshot.state !== "waiting") return;

    const room = pendingJoin.code;
    consumeRoomJoin();
    const problem = validateRoomCode(room);
    if (problem) {
      setError(`邀请链接中的房间码无效：${problem}`);
      return;
    }
    void guest(room, koringName || undefined, publicNodes);
  }, [
    pendingJoin,
    loaded,
    loggedIn,
    status.binary.installed,
    phase,
    snapshot.state,
    snapshot.room,
    start,
    guest,
    setError,
    consumeRoomJoin,
    koringName,
    publicNodes,
  ]);

  // 双卡视图：等待中 / 房间已开启 / 已加入房间
  const cardsOnly =
    loaded &&
    loggedIn &&
    status.binary.installed &&
    phase === "running" &&
    (snapshot.state === "waiting" || snapshot.state === "host-ok" || snapshot.state === "guest-ok");

  // 未登录：只展示一条占满宽度的提示条（不暴露安装/服务细节）
  const bannerOnly = loaded && !loggedIn;

  const renderBody = () => {
    if (!loggedIn) return <LoginRequiredBanner />;
    if (cardsOnly) return <WaitingPanels />;
    return <StatusNotice />;
  };

  return (
    <div className="relative h-full">
      <div
        className={cn(
          "h-full overflow-y-auto scroll-area p-6",
          (cardsOnly || bannerOnly) && "grid place-items-center",
        )}
      >
        <div className={cn("w-full", cardsOnly || bannerOnly ? "max-w-4xl" : "grid place-items-center")}>
          {/* 错误横幅（提示条视图里也保留，便于看到深链/加入失败原因） */}
          {error ? (
            <div className="mb-4 flex w-full items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/[0.07] px-4 py-3">
              <AlertCircle className="mt-0.5 w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
              <p className="min-w-0 flex-1 text-[12px] leading-relaxed text-red-600 dark:text-red-400">
                {error}
              </p>
              <button
                type="button"
                onClick={clearError}
                aria-label="关闭错误提示"
                className="shrink-0 rounded p-0.5 text-red-500/70 transition-colors hover:text-red-500"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : null}

          {loaded ? renderBody() : <StatusNotice />}
        </div>
      </div>
    </div>
  );
}
