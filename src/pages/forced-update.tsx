import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Download, RotateCw } from "lucide-react";
import {
  launcherVersionPolicy,
  type VersionPolicyResult,
} from "@/api/launcher-api";
import {
  getForcedUpdateState,
  installForcedUpdate,
  onForcedUpdateStatus,
  prepareForcedUpdate,
  type ForcedUpdateStatus,
} from "@/api/forced-update";
import { useConfigStore } from "@/stores/configStore";
import { VERSION } from "@/lib/version";

/** 大圆环尺寸（像素） */
const RING_SIZE = 248;
const STROKE = 14;
const RADIUS = (RING_SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(1)} MB`;
}

/**
 * 强制升级（强下载版本）页面。
 *
 * 由版本策略触发（OOBE/UPVP 版本激活步骤的「强制升级」、或启动门禁判定 force_upgrade）：
 * - 顶栏复用 OOBE 样式（无返回按钮、无主导航）；
 * - 进入即按 API 下发的目标版本下载安装包，大圆环显示进度；
 * - 下载完成后「立即安装」不做二次校验，直接静默安装（dev 下仅重启应用）；
 * - 若上次已下载过且版本满足要求，重新进入页面直接可安装（不会重复下载）。
 */
export function ForcedUpdate() {
  const configTarget = useConfigStore((s) => s.config.activation.upgradeTarget);
  const [policy, setPolicy] = useState<VersionPolicyResult | null>(null);
  const [status, setStatus] = useState<ForcedUpdateStatus | null>(null);
  const [error, setError] = useState("");
  const startedRef = useRef(false);

  // 订阅主进程下载状态（进度 / 完成 / 失败）
  useEffect(() => {
    const off = onForcedUpdateStatus((s) => setStatus(s));
    void getForcedUpdateState()
      .then((s) => {
        if (s.state !== "idle") setStatus(s);
      })
      .catch(() => undefined);
    return off;
  }, []);

  const start = useCallback(async (target?: string) => {
    setError("");
    try {
      const s = await prepareForcedUpdate(target);
      setStatus(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  // 进入页面：先查版本策略（决定文案与目标版本），再开始下载
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    let cancelled = false;
    void (async () => {
      let target: string | undefined;
      try {
        const p = await launcherVersionPolicy(VERSION);
        if (cancelled) return;
        setPolicy(p);
        target = p.upgrade_target_version ?? p.min_upgrade_version ?? undefined;
      } catch {
        /* 策略查询失败：回退到本地记录的升级目标 */
      }
      if (cancelled) return;
      await start(target || configTarget || undefined);
    })();
    return () => {
      cancelled = true;
    };
  }, [configTarget, start]);

  const state = status?.state ?? "idle";
  const percent = Math.max(0, Math.min(100, status?.percent ?? 0));
  const dev = status?.dev ?? false;
  const ready = state === "downloaded";
  const installing = state === "installing";
  const failed = state === "error" || Boolean(error);

  const minVersion = policy?.min_upgrade_version ?? null;
  const title = minVersion
    ? `KoringDevice 要求您升级至≥v${minVersion}的版本。`
    : "该版本启动器被要求强制升级。";
  const desc = minVersion
    ? `因不可控原因，该启动器版本有缺陷，现已要求升级至≥v${minVersion}的版本。`
    : "该版本启动器因其版本问题已被要求强制升级至最新版本。";
  const targetVersion = status?.version ?? policy?.upgrade_target_version ?? configTarget ?? null;

  const stateLabel =
    state === "resolving"
      ? "正在获取版本信息"
      : state === "downloading"
        ? "正在下载安装包"
        : state === "downloaded"
          ? "下载完成"
          : state === "installing"
            ? "正在安装"
            : state === "error"
              ? "下载失败"
              : "准备下载";

  const handleInstall = async () => {
    setError("");
    try {
      await installForcedUpdate();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const errorText = error || (state === "error" ? status?.error ?? "" : "");
  const buttonLabel = installing
    ? "正在安装..."
    : ready
      ? "立即安装"
      : failed
        ? "重新下载"
        : "等待下载完毕";

  return (
    <div className="h-full flex flex-col items-center justify-center px-8 py-10">
      <div className="w-full max-w-2xl flex flex-col items-center gap-8 text-center">
        <div className="space-y-3">
          <h2 className="text-2xl font-bold text-foreground leading-snug">{title}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-xl mx-auto">{desc}</p>
          {targetVersion && (
            <p className="text-xs text-muted-foreground/70">目标版本 v{targetVersion}</p>
          )}
        </div>

        {/* 大圆环下载进度 */}
        <div className="relative shrink-0" style={{ width: RING_SIZE, height: RING_SIZE }}>
          <svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`} className="-rotate-90">
            <circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RADIUS}
              fill="none"
              strokeWidth={STROKE}
              className="text-foreground/[0.08]"
              stroke="currentColor"
            />
            <circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RADIUS}
              fill="none"
              strokeWidth={STROKE}
              strokeLinecap="round"
              stroke="currentColor"
              className={failed ? "text-red-500 transition-[stroke-dashoffset] duration-200 ease-out" : "text-amber-400 transition-[stroke-dashoffset] duration-200 ease-out"}
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - percent / 100)}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
            <span className="text-4xl font-bold tabular-nums text-foreground">
              {Math.round(percent)}
              <span className="text-lg font-semibold text-muted-foreground">%</span>
            </span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              {state === "downloading" || state === "resolving" ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : null}
              {stateLabel}
            </span>
            {status && status.total > 0 && (
              <span className="text-[11px] text-muted-foreground/60 tabular-nums">
                {formatBytes(status.transferred)} / {formatBytes(status.total)}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-center gap-3">
          <button
            onClick={() => void (failed ? start(targetVersion ?? configTarget ?? undefined) : handleInstall())}
            disabled={!ready && !failed}
            className="flex items-center gap-2 h-11 px-8 rounded-xl text-sm font-semibold bg-amber-500 hover:bg-amber-400 text-black transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:bg-amber-500"
          >
            {installing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : ready ? (
              <Download className="w-4 h-4" />
            ) : failed ? (
              <RotateCw className="w-4 h-4" />
            ) : null}
            {buttonLabel}
          </button>

          {errorText && <p className="text-xs text-red-500 break-words max-w-md">{errorText}</p>}

          {dev && (
            <p className="text-xs text-muted-foreground/60 leading-relaxed max-w-md">
              开发模式：点击「立即安装」将仅重启启动器，不会执行安装。
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
