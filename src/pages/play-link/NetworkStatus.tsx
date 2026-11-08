import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import type { TcSnapshot } from "@/api/terracotta";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { useTerracottaStore } from "@/stores/terracottaStore";

/** 折线图保留的采样点数（主进程 500ms 轮询一次 /state） */
const MAX_SAMPLES = 40;

/** 上游状态 → 面向用户的中文描述 */
const STATE_TEXT: Record<string, string> = {
  waiting: "等待开始",
  "host-scanning": "正在扫描局域网",
  "host-starting": "正在创建房间",
  "host-ok": "房间已创建",
  "guest-connecting": "正在连接房主",
  "guest-starting": "正在加入房间",
  "guest-ok": "已加入房间",
  exception: "连接异常",
  unknown: "未知",
};

/** 状态 → 状态点颜色 */
const STATE_TONE: Record<string, string> = {
  "host-ok": "bg-emerald-500",
  "guest-ok": "bg-emerald-500",
  exception: "bg-red-500",
};

type TierKey = "best" | "good" | "fair" | "poor" | "pending";

const QUALITY: Record<TierKey, { label: string; color: string }> = {
  best: { label: "优秀", color: "#10b981" },
  good: { label: "良好", color: "#14b8a6" },
  fair: { label: "一般", color: "#f59e0b" },
  poor: { label: "较差", color: "#ef4444" },
  pending: { label: "检测中", color: "#94a3b8" },
};

/** 陶瓦的打洞难度（difficulty）→ 连接质量档位 */
const DIFFICULTY_TIER: Record<string, TierKey> = {
  EASIEST: "best",
  SIMPLE: "good",
  MEDIUM: "fair",
  TOUGH: "poor",
};

/** 无 difficulty 时用往返耗时估算（ms） */
function tierFromLatency(latency: number): TierKey {
  if (!latency) return "pending";
  if (latency <= 40) return "best";
  if (latency <= 90) return "good";
  if (latency <= 160) return "fair";
  return "poor";
}

/** 数据面探测状态 → 文案 */
const TUNNEL_TEXT: Record<string, string> = {
  unknown: "待验证",
  checking: "验证中…",
  ok: "正常",
  failed: "不通",
};

/**
 * 房间内的「连接质量」面板：折线图直接铺满整张卡（作为卡片背景，从卡片边缘起画），
 * 质量档位优先取陶瓦返回的打洞难度（difficulty），房主态回退用链路往返耗时估算。
 */
export function NetworkStatus({ snapshot }: { snapshot: TcSnapshot }) {
  const gradientId = useId().replace(/:/g, "");
  const latency = useTerracottaStore((s) => s.status.snapshot.latencyMs);
  const tunnel = useTerracottaStore((s) => s.status.tunnel);
  const isGuest = snapshot.state === "guest-ok" || snapshot.state === "guest-starting";

  const tierKey = DIFFICULTY_TIER[snapshot.difficulty?.toUpperCase?.() ?? ""] ?? tierFromLatency(latency);
  const quality = QUALITY[tierKey];

  const chartConfig: ChartConfig = {
    latency: { label: "链路耗时", color: quality.color },
  };

  /** 采样：真实取 500ms 轮询的 /state 往返耗时，反映链路抖动 */
  const [samples, setSamples] = useState<number[]>([]);
  const lastSampleRef = useRef(0);

  useEffect(() => {
    if (!latency || latency === lastSampleRef.current) return;
    lastSampleRef.current = latency;
    setSamples((prev) => [...prev, latency].slice(-MAX_SAMPLES));
  }, [latency]);

  const data = useMemo(() => {
    const list = samples.length > 0 ? samples : [Math.max(latency, 1)];
    // 少于两个点时折线画不出来，补一个同值点保证有基线
    const values = list.length === 1 ? [list[0], list[0]] : list;
    return values.map((value, index) => ({ index, latency: value }));
  }, [samples, latency]);

  return (
    <>
      {/* 背景折线图：绝对定位贴在卡片下半部分，无内边距、无坐标轴 */}
      <ChartContainer
        config={chartConfig}
        className="pointer-events-none absolute inset-x-0 bottom-0 z-0 aspect-auto h-1/2 w-full [&_.recharts-responsive-container]:h-full"
      >
        <AreaChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={quality.color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={quality.color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.06} />
          <XAxis dataKey="index" hide />
          {/* 顶部留 2 倍余量：避免数据几乎持平时折线贴在最上沿看不见 */}
          <YAxis hide domain={[0, (max: number) => Math.max(Math.ceil(max * 2), 10)]} />
          <Area
            type="monotone"
            dataKey="latency"
            stroke={quality.color}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={false}
            isAnimationActive
            animationBegin={0}
            animationDuration={450}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ChartContainer>

      {/* 前景信息：标题 + 质量档位（紧贴标题下方） */}
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-foreground">连接质量</h3>
          <span className="text-[34px] font-bold leading-none tracking-[-0.03em]" style={{ color: quality.color }}>
            {quality.label}
          </span>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
          <span className={cn("size-1.5 rounded-full", STATE_TONE[snapshot.state] ?? "bg-amber-500")} />
          {STATE_TEXT[snapshot.state] ?? snapshot.state}
        </span>
      </div>

      {/* 加入方：控制面 guest-ok 之后的数据面探测结果（隧道是否真的能通到房主 MC） */}
      {isGuest ? (
        <p className="relative z-10 mt-2 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
          <span
            className={cn(
              "mt-1 size-1.5 shrink-0 rounded-full",
              tunnel.state === "ok"
                ? "bg-emerald-500"
                : tunnel.state === "failed"
                  ? "bg-red-500"
                  : "animate-pulse bg-amber-500",
            )}
          />
          <span>
            数据通道
            <span
              className={cn(
                "ml-1 font-medium",
                tunnel.state === "ok"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : tunnel.state === "failed"
                    ? "text-red-600 dark:text-red-400"
                    : "text-foreground",
              )}
            >
              {TUNNEL_TEXT[tunnel.state]}
            </span>
            {tunnel.detail && tunnel.state !== "checking" ? `　${tunnel.detail}` : null}
          </span>
        </p>
      ) : null}

      {/* 加入方：上游 guest-ok 给出的直连地址，可在「多人游戏 → 直接连接」里使用 */}
      {snapshot.url ? (
        <p className="relative z-10 mt-auto text-[11.5px] leading-relaxed text-muted-foreground">
          备用直连地址{" "}
          <span className="font-mono text-foreground">{snapshot.url}</span>
          <span className="ml-1">（可在「多人游戏 → 直接连接」里使用）</span>
        </p>
      ) : null}
    </>
  );
}
