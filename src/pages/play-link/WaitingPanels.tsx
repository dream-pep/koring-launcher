import { useState } from "react";
import { Button } from "@heroui/react";
import { ROOM_CODE_LENGTH, formatRoomCodeInput, validateRoomCode } from "@/api/terracotta";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useConfigStore } from "@/stores/configStore";
import { useTerracottaStore } from "@/stores/terracottaStore";

/** 与 SettingSurface 一致的卡片外观（设置页同款磨砂背景） */
const SURFACE_CLS =
  "rounded-xl border border-black/[0.06] bg-white/85 shadow-sm backdrop-blur-[12px] dark:border-white/[0.07] dark:bg-black/45";

const HOVER_CLS =
  "transition-[transform,box-shadow] duration-200 ease-linear hover:z-10 hover:scale-[1.02] hover:shadow-md active:scale-[0.995]";

/**
 * waiting 状态：两张卡片按 1:2 分栏，鼠标移入放大。
 * 左「创建房间」整卡可点（不是内容展示）；右「加入房间」直接内嵌房间码输入框。
 */
export function WaitingPanels() {
  const savedName = useConfigStore((s) => s.config.network.terracotta?.playerName ?? "");
  const publicNodes = useConfigStore((s) => s.config.network.terracotta?.publicNodes ?? []);

  const host = useTerracottaStore((s) => s.host);
  const guest = useTerracottaStore((s) => s.guest);
  const pendingHost = useTerracottaStore((s) => s.pending.host);
  const pendingGuest = useTerracottaStore((s) => s.pending.guest);

  const [room, setRoom] = useState("");
  const [hostStarted, setHostStarted] = useState(false);

  const payload = formatRoomCodeInput(room);
  const roomError = payload ? validateRoomCode(payload) : null;
  const canJoin = !pendingGuest && payload.length === ROOM_CODE_LENGTH && roomError === null;
  const invalidChar = !!roomError?.includes("无效字符");
  const showError = payload.length > 0 && (invalidChar || payload.length >= ROOM_CODE_LENGTH);

  const hostBusy = pendingHost || hostStarted;

  const handleHost = () => {
    if (hostBusy) return;
    setHostStarted(true);
    void host(savedName.trim() || undefined, publicNodes);
  };

  const handleJoin = () => {
    if (!canJoin) return;
    void guest(payload, savedName.trim() || undefined, publicNodes);
  };

  return (
    <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-3">
      {/* 左：创建房间（占 1 份，整卡点击） */}
      <button
        type="button"
        onClick={handleHost}
        disabled={hostBusy}
        aria-label="创建房间"
        className={cn(
          SURFACE_CLS,
          HOVER_CLS,
          "group flex min-h-[280px] cursor-pointer flex-col justify-between gap-6 p-6 text-left",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          "disabled:cursor-wait md:col-span-1",
        )}
      >
        <p className="max-w-[24ch] text-[12.5px] leading-relaxed text-muted-foreground">
          游戏内打开「对局域网开放」，陶瓦会自动识别并生成房间码。
        </p>
        <span className="self-end text-right text-[26px] font-bold leading-none tracking-[-0.02em] text-foreground">
          {hostBusy ? "正在创建…" : "创建房间"}
        </span>
      </button>

      {/* 右：加入房间（占 2 份），标题在左上、输入框在卡片底部 */}
      <div
        className={cn(
          SURFACE_CLS,
          HOVER_CLS,
          "flex min-h-[280px] flex-col justify-between gap-6 p-6 md:col-span-2",
        )}
      >
        <h3 className="text-[26px] font-bold leading-none tracking-[-0.02em] text-foreground">
          加入房间
        </h3>
        <div className="flex flex-col gap-2">
          <p
            className={cn(
              "text-[11.5px] leading-relaxed",
              showError ? "text-danger" : "text-muted-foreground",
            )}
          >
            {showError
              ? roomError
              : payload.length > 0
                ? `已输入 ${payload.length} / ${ROOM_CODE_LENGTH} 位`
                : "粘贴好友分享的房间码即可加入"}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={room}
              onChange={(event) => setRoom(formatRoomCodeInput(event.target.value))}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleJoin();
              }}
              placeholder="U/XXXX-XXXX-XXXX-XXXX"
              aria-label="房间码"
              aria-invalid={roomError !== null}
              spellCheck={false}
              autoComplete="off"
              disabled={pendingGuest}
              className={cn(
                "h-11 font-mono tracking-[0.08em] sm:flex-1",
                pendingGuest && "cursor-wait",
              )}
            />
            <Button
              variant="primary"
              className="h-11 shrink-0"
              onPress={handleJoin}
              isDisabled={!canJoin}
            >
              {pendingGuest ? "正在加入…" : "加入房间"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
