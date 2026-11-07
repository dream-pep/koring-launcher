import { Button } from "@heroui/react";
import { AlertTriangle, Loader2, RotateCcw } from "lucide-react";
import { useTerracottaStore } from "@/stores/terracottaStore";
import { StateCard } from "./StateCard";

/** 上游 exceptionType → 中文文案（契约 9.1 ⑪） */
const EXCEPTION_TEXT: Record<number, string> = {
  0: "无法连接房主，房间可能已关闭。",
  1: "与房主的连接已中断。",
  2: "加入方的 EasyTier 组件崩溃了，请重新尝试加入。",
  3: "房主的 EasyTier 组件崩溃了，请让房主重启联机服务。",
  4: "房主的游戏服务器已失联，房间已自动关闭。",
  5: "联机协议出现错误，可能是双方版本不一致，请更新陶瓦联机后重试。",
};

export function ExceptionCard() {
  const exceptionType = useTerracottaStore((s) => s.status.snapshot.exceptionType);
  const snapshotError = useTerracottaStore((s) => s.status.snapshot.error);
  const reset = useTerracottaStore((s) => s.reset);
  const pending = useTerracottaStore((s) => s.pending.reset);

  const reason =
    EXCEPTION_TEXT[exceptionType] ??
    (exceptionType >= 0 ? `联机出现异常（错误码 ${exceptionType}）。` : "联机出现未知异常。");

  return (
    <StateCard
      icon={<AlertTriangle className="w-5 h-5" />}
      tone="danger"
      title="联机出现异常"
      description={reason}
      actions={
        <Button variant="primary" onPress={() => void reset()} isDisabled={pending}>
          {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
          返回
        </Button>
      }
    >
      {snapshotError ? (
        <p className="rounded-lg border border-red-500/20 bg-red-500/[0.06] px-3 py-2 text-[12px] leading-relaxed text-red-600 dark:text-red-400">
          {snapshotError}
        </p>
      ) : null}
    </StateCard>
  );
}
