import { toast as sonnerToast } from "sonner";
import { useNoticeStore, type ToastRecord } from "@/stores/noticeStore";

/**
 * 全局通知门面（`@/lib/toast`）。
 *
 * 为什么要有这一层：
 * - sonner 的默认时长是 4s，不适合按语义区分：成功应当更快离开视线，错误/警告需要留够阅读时间；
 * - 各调用点不应该各自硬编码 `duration`，统一在这里按类型给默认值，调用方仍可显式覆盖；
 * - 常驻通知（需要用户手动关闭/带操作按钮）统一走 `toast.persistent`，避免散落的 `duration: Infinity`；
 * - 每次调用同时写入 noticeStore 历史，供右侧任务/通知面板回看。
 *
 * 用法：
 * ```ts
 * import { toast } from "@/lib/toast";
 * toast.success("已保存");
 * toast.error("保存失败", { description: detail, duration: 8000 }); // 显式时长覆盖默认值
 * toast.persistent("有可用更新", { id: "update", action: { label: "查看", onClick } });
 * ```
 */

/** sonner 单条通知的选项类型（id / description / action / closeButton / 显式 duration 等） */
export type ToastOptions = NonNullable<Parameters<typeof sonnerToast.success>[1]>;

/** 通知正文类型（与 sonner 保持一致：字符串或 ReactNode） */
export type ToastMessage = Parameters<typeof sonnerToast.success>[0];

/** 各类型通知的默认停留时长（毫秒）；loading 常驻，直到同 id 更新或手动关闭 */
export const TOAST_DURATION = {
  success: 2400,
  info: 3200,
  warning: 5000,
  error: 6500,
  loading: Infinity,
} as const;

/** 系统级通知的 id 前缀：这类通知已由「系统通知」区展示，不再重复记入交互历史 */
const SYSTEM_NOTICE_PREFIXES = ["startup-notice:", "runtime-notice:"];

/**
 * 记录一条通知到全局历史（右侧面板读取）。
 * - 正文为 ReactNode 时存占位文案，避免把组件塞进 store；
 * - 同 id 的通知（如 loading → success）在 store 内替换而非重复追加；
 * - 系统级通知（服务端公告 / 主进程运行时提示）跳过，避免与「系统通知」区重复展示。
 */
function recordToast(type: ToastRecord["type"], message: ToastMessage, options?: ToastOptions) {
  const text = typeof message === "string" ? message : "（富文本通知）";
  const description = typeof options?.description === "string" ? options.description : undefined;
  const rawId = options?.id;
  // 系统通知已在 noticeStore.systemNotices 中展示，这里不再写入交互历史
  if (rawId !== undefined && rawId !== null) {
    const idText = String(rawId);
    if (SYSTEM_NOTICE_PREFIXES.some((prefix) => idText.startsWith(prefix))) return;
  }
  const id =
    rawId !== undefined && rawId !== null
      ? String(rawId)
      : `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  useNoticeStore.getState().pushToast({
    id,
    type,
    message: text,
    description,
    time: Date.now(),
  });
}

/**
 * 通知门面：类型方法带默认时长（调用方 options 覆盖默认值，含显式 duration），
 * `dismiss` / `promise` / `custom` 直接透传 sonner 原函数以保持签名。
 */
export const toast = {
  success: (message: ToastMessage, options?: ToastOptions) => {
    recordToast("success", message, options);
    return sonnerToast.success(message, { duration: TOAST_DURATION.success, ...options });
  },
  info: (message: ToastMessage, options?: ToastOptions) => {
    recordToast("info", message, options);
    return sonnerToast.info(message, { duration: TOAST_DURATION.info, ...options });
  },
  warning: (message: ToastMessage, options?: ToastOptions) => {
    recordToast("warning", message, options);
    return sonnerToast.warning(message, { duration: TOAST_DURATION.warning, ...options });
  },
  error: (message: ToastMessage, options?: ToastOptions) => {
    recordToast("error", message, options);
    return sonnerToast.error(message, { duration: TOAST_DURATION.error, ...options });
  },
  loading: (message: ToastMessage, options?: ToastOptions) => {
    recordToast("loading", message, options);
    return sonnerToast.loading(message, { duration: TOAST_DURATION.loading, ...options });
  },
  /** 常驻通知：默认不自动消失且带关闭按钮，适合需要用户处理/确认的提示 */
  persistent: (message: ToastMessage, options?: ToastOptions) => {
    recordToast("default", message, options);
    return sonnerToast(message, { duration: Infinity, closeButton: true, ...options });
  },
  dismiss: sonnerToast.dismiss,
  promise: sonnerToast.promise,
  custom: sonnerToast.custom,
};
