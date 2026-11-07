import { Button } from "@heroui/react";
import { Loader2, Radar, Radio, Square, X } from "lucide-react";
import { useTerracottaStore } from "@/stores/terracottaStore";
import { MemberList } from "./MemberList";
import { RoomCodeDisplay } from "./RoomCodeDisplay";
import { StateCard } from "./StateCard";

/** 状态⑥：host-scanning —— 等待游戏中开启「对局域网开放」 */
export function HostScanningCard() {
  const reset = useTerracottaStore((s) => s.reset);
  const pending = useTerracottaStore((s) => s.pending.reset);

  return (
    <StateCard
      icon={<Radar className="w-5 h-5 animate-pulse" />}
      tone="primary"
      title="正在等待游戏房间…"
      description={
        <>
          请启动游戏并进入单人存档，在暂停菜单中点击
          <span className="mx-1 font-medium text-foreground">「对局域网开放」</span>
          ，陶瓦会自动识别并创建房间。
        </>
      }
      actions={
        <Button variant="outline" onPress={() => void reset()} isDisabled={pending}>
          {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
          取消
        </Button>
      }
    />
  );
}

/** 状态⑦：host-starting —— 房间创建中 */
export function HostStartingCard() {
  const room = useTerracottaStore((s) => s.status.snapshot.room);
  const reset = useTerracottaStore((s) => s.reset);
  const pending = useTerracottaStore((s) => s.pending.reset);

  return (
    <StateCard
      icon={<Loader2 className="w-5 h-5 animate-spin" />}
      tone="primary"
      title="正在创建房间…"
      description="已识别到游戏房间，正在通过公共节点建立联机通道，请稍候。"
      actions={
        <Button variant="outline" onPress={() => void reset()} isDisabled={pending}>
          {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
          取消
        </Button>
      }
    >
      <RoomCodeDisplay code={room} compact />
    </StateCard>
  );
}

/** 状态⑧：host-ok —— 房间已就绪 */
export function HostOkCard() {
  const room = useTerracottaStore((s) => s.status.snapshot.room);
  const profiles = useTerracottaStore((s) => s.status.snapshot.profiles);
  const reset = useTerracottaStore((s) => s.reset);
  const stop = useTerracottaStore((s) => s.stop);
  const pendingReset = useTerracottaStore((s) => s.pending.reset);
  const pendingStop = useTerracottaStore((s) => s.pending.stop);

  return (
    <StateCard
      icon={<Radio className="w-5 h-5" />}
      tone="success"
      title="房间已创建"
      description="把房间码发给好友，等他们加入后就能一起游玩。游戏内「多人游戏」会自动出现你的存档。"
      actions={
        <>
          <Button variant="outline" onPress={() => void reset()} isDisabled={pendingReset}>
            {pendingReset ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
            关闭房间
          </Button>
          <Button variant="ghost" onPress={() => void stop()} isDisabled={pendingStop}>
            {pendingStop ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />}
            停止服务
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <RoomCodeDisplay code={room} />
        <MemberList profiles={profiles} />
      </div>
    </StateCard>
  );
}
