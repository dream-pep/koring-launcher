import { useEffect } from "react";
import { toast } from "sonner";

/**
 * 主进程运行时提示（一次性，kind 去重）：
 * 目前用于 Linux 未以 AppImage 方式运行时提示更新组件受影响。
 */
export function RuntimeNotices() {
  useEffect(() => {
    const unsub = window.electronAPI?.onRuntimeNotice?.((notice) => {
      if (!notice?.message) return;
      // id 固定 → 同一提示只出现一次（页面刷新也不会重复弹）
      toast.warning(notice.message, {
        id: `runtime-notice:${notice.kind ?? "generic"}`,
        duration: Infinity,
        closeButton: true,
      });
    });
    return () => {
      unsub?.();
    };
  }, []);

  return null;
}
