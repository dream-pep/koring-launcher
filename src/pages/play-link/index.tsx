import { useEffect, useRef } from "react";
import { Button } from "@heroui/react";
import { AlertCircle, Loader2, Square, X } from "lucide-react";
import { EMPTY_TERRACOTTA_STATUS } from "@/api/terracotta";
import { useConfigStore } from "@/stores/configStore";
import { useTerracottaStore } from "@/stores/terracottaStore";
import { cn } from "@/lib/utils";
import { ExceptionCard } from "./ExceptionCard";
import { GuestConnectingCard, GuestOkCard } from "./GuestCards";
import { HostOkCard, HostScanningCard, HostStartingCard } from "./HostCards";
import { InstallCard } from "./InstallCard";
import { CrashedCard, IdleCard, StartingCard, UnknownCard } from "./ServiceCards";
import { StateCard } from "./StateCard";
import { WaitingPanels } from "./WaitingPanels";

const PHASE_META = {
  stopped: { label: "未启动", cls: "border-border/40 bg-foreground/[0.05] text-muted-foreground" },
  starting: { label: "启动中", cls: "border-sky-500/25 bg-sky-500/10 text-sky-600 dark:text-sky-400" },
  running: {
    label: "运行中",
    cls: "border-green-500/25 bg-green-500/10 text-green-600 dark:text-green-400",
  },
  crashed: { label: "已崩溃", cls: "border-red-500/25 bg-red-500/10 text-red-600 dark:text-red-400" },
} as const;

/** 首次加载占位（避免在拿到真实状态前闪现「未安装」） */
function LoadingCard() {
  return (
    <StateCard
      icon={<Loader2 className="w-5 h-5 animate-spin" />}
      tone="primary"
      title="正在读取联机状态…"
      description="正在与主进程同步陶瓦联机的安装与运行状态。"
    />
  );
}

export function PlayLink() {
  const status = useTerracottaStore((s) => s.status);
  const loaded = useTerracottaStore((s) => s.loaded);
  const error = useTerracottaStore((s) => s.error);
  const clearError = useTerracottaStore((s) => s.clearError);
  const init = useTerracottaStore((s) => s.init);
  const start = useTerracottaStore((s) => s.start);
  const stop = useTerracottaStore((s) => s.stop);
  const pendingStop = useTerracottaStore((s) => s.pending.stop);
  const autoStart = useConfigStore((s) => s.config.network.terracotta?.autoStart ?? false);
  const savedName = useConfigStore((s) => s.config.network.terracotta?.playerName ?? "");

  // 订阅主进程状态事件，卸载时退订（服务本身保持运行）
  useEffect(() => init(), [init]);

  // 自动启动：每个页面实例最多触发一次
  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (autoStartedRef.current) return;
    if (!loaded || !autoStart) return;
    if (!status.binary.installed) return;
    if (status.phase !== "stopped") return;
    autoStartedRef.current = true;
    void start(savedName.trim() || undefined);
  }, [loaded, autoStart, status.binary.installed, status.phase, start, savedName]);

  const phase = status.phase || EMPTY_TERRACOTTA_STATUS.phase;
  const snapshot = status.snapshot || EMPTY_TERRACOTTA_STATUS.snapshot;
  const phaseMeta = PHASE_META[phase] ?? PHASE_META.stopped;
  const version = status.meta?.version || status.binary.version;

  // waiting 且服务运行中：整页只放两张卡片（居中、无标题无状态徽章）
  const waiting = loaded && status.binary.installed && phase === "running" && snapshot.state === "waiting";

  const renderBody = () => {
    // ① 未安装
    if (!status.binary.installed) return <InstallCard />;
    // ②③④ 进程态
    if (phase === "starting") return <StartingCard />;
    if (phase === "crashed") return <CrashedCard />;
    if (phase === "stopped") return <IdleCard />;
    // ⑤~⑪ 上游状态机
    switch (snapshot.state) {
      case "waiting":
        return <WaitingPanels />;
      case "host-scanning":
        return <HostScanningCard />;
      case "host-starting":
        return <HostStartingCard />;
      case "host-ok":
        return <HostOkCard />;
      case "guest-connecting":
      case "guest-starting":
        return <GuestConnectingCard />;
      case "guest-ok":
        return <GuestOkCard />;
      case "exception":
        return <ExceptionCard />;
      default:
        return <UnknownCard />;
    }
  };

  return (
    <div className="relative h-full">
      <div
        className={cn(
          "h-full overflow-y-auto scroll-area p-6",
          waiting && "grid place-items-center",
        )}
      >
        <div className={cn("w-full", waiting ? "max-w-4xl" : "mx-auto max-w-3xl space-y-4")}>
          {/* 标题区（waiting 视图不显示） */}
          {!waiting ? (
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-foreground">联机</h2>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  使用陶瓦联机（Terracotta）与好友一起游玩单人存档，无需公网 IP。
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium",
                    phaseMeta.cls,
                  )}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {phaseMeta.label}
                </span>
                {version ? (
                  <span className="rounded-md border border-border/40 bg-foreground/[0.05] px-2 py-0.5 font-mono text-[11px] text-muted-foreground dark:border-white/[0.08]">
                    v{version}
                  </span>
                ) : null}
                {status.binary.installed && phase === "running" ? (
                  <Button size="sm" variant="outline" onPress={() => void stop()} isDisabled={pendingStop}>
                    {pendingStop ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Square className="w-3.5 h-3.5" />
                    )}
                    停止服务
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* 错误横幅 */}
          {error ? (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/[0.07] px-4 py-3">
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

          {loaded ? renderBody() : <LoadingCard />}
        </div>
      </div>
    </div>
  );
}
