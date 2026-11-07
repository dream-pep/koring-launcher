import { Button } from "@heroui/react";
import { CheckCircle2, Loader2, Unplug, X } from "lucide-react";
import { useTerracottaStore } from "@/stores/terracottaStore";
import { cn } from "@/lib/utils";
import { CopyButton } from "./CopyButton";
import { MemberList } from "./MemberList";
import { RoomCodeDisplay } from "./RoomCodeDisplay";
import { StateCard } from "./StateCard";

const DIFFICULTY_LABEL: Record<string, string> = {
  UNKNOWN: "未知",
  EASIEST: "简单",
  SIMPLE: "普通",
  MEDIUM: "中等",
  TOUGH: "困难",
};

const DIFFICULTY_CLS: Record<string, string> = {
  UNKNOWN: "border-border/40 bg-foreground/[0.05] text-muted-foreground",
  EASIEST: "border-green-500/25 bg-green-500/10 text-green-600 dark:text-green-400",
  SIMPLE: "border-sky-500/25 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  MEDIUM: "border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  TOUGH: "border-red-500/25 bg-red-500/10 text-red-600 dark:text-red-400",
};

function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const key = difficulty || "UNKNOWN";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium",
        DIFFICULTY_CLS[key] ?? DIFFICULTY_CLS.UNKNOWN,
      )}
    >
      难度：{DIFFICULTY_LABEL[key] ?? difficulty}
    </span>
  );
}

/** 状态⑨：guest-connecting / guest-starting —— 正在加入 */
export function GuestConnectingCard() {
  const room = useTerracottaStore((s) => s.status.snapshot.room);
  const difficulty = useTerracottaStore((s) => s.status.snapshot.difficulty);
  const reset = useTerracottaStore((s) => s.reset);
  const pending = useTerracottaStore((s) => s.pending.reset);

  return (
    <StateCard
      icon={<Loader2 className="w-5 h-5 animate-spin" />}
      tone="primary"
      title="正在加入房间…"
      description="正在连接房主并建立联机通道，通常需要几秒钟。加入后请在游戏「多人游戏」列表中进入存档。"
      actions={
        <Button variant="outline" onPress={() => void reset()} isDisabled={pending}>
          {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
          取消
        </Button>
      }
    >
      <div className="space-y-3">
        <RoomCodeDisplay code={room} compact />
        <DifficultyBadge difficulty={difficulty} />
      </div>
    </StateCard>
  );
}

/** 状态⑩：guest-ok —— 已加入 */
export function GuestOkCard() {
  const url = useTerracottaStore((s) => s.status.snapshot.url);
  const room = useTerracottaStore((s) => s.status.snapshot.room);
  const profiles = useTerracottaStore((s) => s.status.snapshot.profiles);
  const reset = useTerracottaStore((s) => s.reset);
  const pending = useTerracottaStore((s) => s.pending.reset);
  const directAddress = url || room;

  return (
    <StateCard
      icon={<CheckCircle2 className="w-5 h-5" />}
      tone="success"
      title="已加入房间"
      description="联机通道已建立。打开游戏 →「多人游戏」→ 刷新，即可看到房主的存档。"
      actions={
        <Button variant="outline" onPress={() => void reset()} isDisabled={pending}>
          {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unplug className="w-4 h-4" />}
          断开连接
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-border/40 bg-foreground/[0.03] px-4 py-3 dark:border-white/[0.08]">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] tracking-wider text-muted-foreground uppercase">直连地址</p>
              <p className="mt-1 break-all font-mono text-[13px] text-foreground">
                {directAddress || "等待分配地址…"}
              </p>
            </div>
            <CopyButton text={directAddress} />
          </div>
        </div>
        <MemberList profiles={profiles} />
      </div>
    </StateCard>
  );
}
