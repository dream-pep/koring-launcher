import { create } from "zustand";
import { launcherDeviceCheck } from "@/api/launcher-api";

/**
 * 开发者模式（服务端下发）。
 *
 * 来源：Account API 设备接口响应里的 `data.developer_mode`
 * （`GET /api/v1/device/status` 与 `POST /api/v1/device/report` 同一结构）。
 * 语义：只有服务端明确返回 true 才显示设置里的「开发者选项」入口；false（含未取到、
 * 接口异常）一律隐藏。默认 false，不落盘。
 *
 * 刷新策略（关键：不要因为重复检查打爆限流）：
 * - 触发点有三个，全部收敛到下面同一个 `refreshDeveloperMode()`：
 *   1. 进程启动 —— 启动门禁 ActivationGate 的 startupCheck（顺带拿到该字段）；
 *   2. 进入设置页 —— 设置页挂载时刷新；
 *   3. 窗口重新获得焦点（用户回到启动器）—— 全局 focus / visibilitychange。
 * - 冷却：距上次**校验成功** `DEV_MODE_REFRESH_MS`（默认 5 分钟）内不再发请求；
 *   另外任何一次**尝试**（含失败）都有 `DEV_MODE_RETRY_BACKOFF_MS`（默认 30 秒）的退避，
 *   且在途请求会被合并 —— 因此最多每 5 分钟 1 次设备状态查询。
 * - 设备四接口 + 版本两接口共享 120 次/分钟的限流桶（按 IP），这个量级完全安全。
 */

/** 距上次成功校验多久才允许再次刷新（5 分钟） */
export const DEV_MODE_REFRESH_MS = 5 * 60 * 1000;
/** 失败/在途时的最短重试间隔（30 秒） */
export const DEV_MODE_RETRY_BACKOFF_MS = 30 * 1000;

interface DeveloperModeState {
  /** 服务端下发的开关值（默认关闭） */
  enabled: boolean;
  /** 最近一次校验成功的时间戳（ms） */
  checkedAt: number;
  /** 最近一次发请求的时间戳（ms，含失败） */
  attemptedAt: number;
  /** 校验成功时写入 */
  apply: (enabled: boolean) => void;
  /** 记录一次尝试（失败时也要退避，避免连点风暴） */
  markAttempted: () => void;
}

export const useDeveloperModeStore = create<DeveloperModeState>((set) => ({
  enabled: false,
  checkedAt: 0,
  attemptedAt: 0,
  apply: (enabled) =>
    set({ enabled: enabled === true, checkedAt: Date.now(), attemptedAt: Date.now() }),
  markAttempted: () => set({ attemptedAt: Date.now() }),
}));

/** 在途请求（并发合并：设置页挂载 + 窗口聚焦可能同时触发） */
let inFlight: Promise<void> | null = null;

/**
 * 按需刷新开发者模式：在冷却窗口内直接返回，不发请求。
 * 供设置页挂载、窗口聚焦等入口调用（进程启动那条走 ActivationGate 的 startupCheck）。
 */
export function refreshDeveloperMode(maxAgeMs: number = DEV_MODE_REFRESH_MS): Promise<void> {
  const { checkedAt, attemptedAt } = useDeveloperModeStore.getState();
  const now = Date.now();
  if (now - checkedAt < maxAgeMs) return Promise.resolve();
  if (now - attemptedAt < DEV_MODE_RETRY_BACKOFF_MS) return Promise.resolve();
  if (inFlight) return inFlight;

  useDeveloperModeStore.getState().markAttempted();
  inFlight = launcherDeviceCheck()
    .then((data) => {
      useDeveloperModeStore.getState().apply(data.developer_mode);
    })
    .catch(() => {
      // 取不到就维持当前值（默认关闭）；退避已在上面记录
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}
