import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@heroui/react";
import { ROOM_CODE_LENGTH, formatRoomCodeInput, roomCodePayload, terracottaInviteLink, validateRoomCode } from "@/api/terracotta";
import { ShareInvite, type SharePlayer } from "@/components/play-link/ShareInvite";
import { ServiceStatusBadge } from "@/components/system/ServiceStatusBadge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useConfigStore } from "@/stores/configStore";
import { useKoringAuthStore } from "@/stores/koringAuthStore";
import { useConfirmDialogStore } from "@/stores/confirmDialogStore";
import { useJoinHistoryStore } from "@/stores/joinHistoryStore";
import { useRouteStore } from "@/stores/routeStore";
import { useTerracottaStore } from "@/stores/terracottaStore";
import { NetworkStatus } from "./NetworkStatus";

/** 与 SettingSurface 一致的卡片外观（设置页同款磨砂背景） */
const SURFACE_CLS =
  "rounded-xl border border-black/[0.06] bg-white/85 shadow-sm backdrop-blur-[12px] dark:border-white/[0.07] dark:bg-black/45";

/** 卡片悬停放大：沿用 index.css 的 spring 缓动 token */
const HOVER_CLS =
  "transition-[scale,transform,box-shadow] duration-200 ease-spring-soft hover:z-10 hover:scale-[1.02] hover:shadow-md active:scale-[0.995]";

/** 房间码补全 `U/` 前缀（上游 host-ok 的 room 不带前缀） */
function toShareRoomCode(room: string): string {
  const value = room.trim();
  if (!value) return "";
  return value.startsWith("U/") ? value : `U/${value}`;
}

/** 历史房间的加入时间：同年显示「MM-DD HH:mm」，跨年显示「YYYY-MM-DD」 */
function formatJoinedAt(timestamp: number): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  const monthDay = `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  if (date.getFullYear() !== new Date().getFullYear()) return `${date.getFullYear()}-${monthDay}`;
  return `${monthDay} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * 联机主视图：
 * - waiting：两张卡片 1:2 分栏；左「创建房间」点击进子页，右「加入房间」点击后向左扩展占满
 *   整行（创建房间卡片收拢），底部出现房间码输入框。
 * - host-ok：左卡「房间已创建」+ 在线人数（点击关闭），右卡网络状态，底部吸附分享面板。
 * - guest-ok：与房主同款布局，左卡文案为「您已加入房间」（点击退出），分享面板按钮为「退出房间」。
 */
export function WaitingPanels() {
  const navigate = useRouteStore((s) => s.navigate);
  const setSettingsSection = useRouteStore((s) => s.setSettingsSection);
  const openDialog = useConfirmDialogStore((s) => s.openDialog);
  const savedName = useKoringAuthStore((s) => s.user?.username ?? "");
  const validateLogin = useKoringAuthStore((s) => s.validate);
  const publicNodes = useConfigStore((s) => s.config.network.terracotta?.publicNodes ?? []);

  const snapshot = useTerracottaStore((s) => s.status.snapshot);
  const guest = useTerracottaStore((s) => s.guest);
  const reset = useTerracottaStore((s) => s.reset);
  const pendingGuest = useTerracottaStore((s) => s.pending.guest);
  const pendingReset = useTerracottaStore((s) => s.pending.reset);

  const joinHistory = useJoinHistoryStore((s) => s.entries);
  const clearJoinHistory = useJoinHistoryStore((s) => s.clear);

  const [room, setRoom] = useState("");
  const [joinExpanded, setJoinExpanded] = useState(false);
  /** 创建房间前的登录校验进行中（防止重复点击） */
  const [checkingLogin, setCheckingLogin] = useState(false);

  const hosting = snapshot.state === "host-ok";
  const joined = snapshot.state === "guest-ok";
  const inRoom = hosting || joined;
  const onlineCount = Math.max(snapshot.profiles.length, 1);

  // 进入房间/状态变化时收起加入卡片，避免占位状态残留
  useEffect(() => {
    if (inRoom) setJoinExpanded(false);
  }, [inRoom]);

  const players = useMemo<SharePlayer[]>(
    () =>
      snapshot.profiles.map((profile) => ({
        id: profile.machineId,
        name: profile.name || "未知玩家",
        // 上游给的是 HOST / LOCAL（本机玩家，即自己）/ GUEST
        role: profile.kind === "HOST" ? "host" : profile.kind === "LOCAL" ? "self" : "guest",
      })),
    [snapshot.profiles],
  );

  // room 里存的是格式化后的展示值（含 U/ 与 -），校验与提交都要基于 16 位负载
  const payload = roomCodePayload(room);
  const roomError = payload ? validateRoomCode(payload) : null;
  const canJoin = !inRoom && !pendingGuest && payload.length === ROOM_CODE_LENGTH && roomError === null;
  const invalidChar = !!roomError?.includes("无效字符");
  const showError = payload.length > 0 && (invalidChar || payload.length >= ROOM_CODE_LENGTH);

  const shareRoomCode = toShareRoomCode(snapshot.room);

  const handleCloseRoom = useCallback(() => {
    openDialog({
      title: hosting ? "关闭联机房间？" : "您要退出房间吗？",
      description: hosting
        ? "关闭后房间会立即结束，好友将无法继续加入。"
        : "退出后您将离开当前联机房间，可随时重新加入。",
      confirmLabel: hosting ? "关闭房间" : "退出房间",
      onConfirm: () => void reset(),
    });
  }, [hosting, openDialog, reset]);

  /**
   * 创建房间前先校验 Koring 登录是否仍然有效：
   * 有效才进入「检查实例」子页；过期弹窗引导重新登录；网络异常只提示稍后重试。
   */
  const handleHost = useCallback(async () => {
    if (inRoom) {
      handleCloseRoom();
      return;
    }
    if (checkingLogin) return;
    setCheckingLogin(true);
    try {
      const result = await validateLogin();
      if (result.status === "ok") {
        navigate("play-link/create");
        return;
      }
      if (result.status === "expired") {
        openDialog({
          title: "登录已过期",
          description: "您的登录已过期，请重新登录。",
          confirmLabel: "重新登录",
          secondaryLabel: "仍然创建",
          confirmVariant: "default",
          onConfirm: () => {
            setSettingsSection("account");
            navigate("setting");
          },
          // 仍然创建：跳过校验直接进「检查实例」页（房间上报可能失败，仅本机可用）
          onSecondary: () => navigate("play-link/create"),
        });
        return;
      }
      openDialog({
        title: "无法验证登录状态",
        description: "网络异常，暂时无法验证登录状态，请稍后重试。",
        confirmLabel: "知道了",
        secondaryLabel: "仍然创建",
        confirmVariant: "default",
        onConfirm: () => {},
        onSecondary: () => navigate("play-link/create"),
      });
    } finally {
      setCheckingLogin(false);
    }
  }, [checkingLogin, handleCloseRoom, inRoom, navigate, openDialog, setSettingsSection, validateLogin]);

  const handleJoin = useCallback(() => {
    if (!canJoin) return;
    // 提交上游要求的规范全码：U/XXXX-XXXX-XXXX-XXXX
    void guest(formatRoomCodeInput(`U/${payload}`), savedName.trim() || undefined, publicNodes);
  }, [canJoin, guest, payload, publicNodes, savedName]);

  const handleCopyRoomCode = useCallback(async () => {
    if (!shareRoomCode) return;
    await navigator.clipboard.writeText(shareRoomCode);
  }, [shareRoomCode]);

  // 复制分享文案：用户名 + 邀请链接 + 房间号 + 客户端提示（好友可直接粘贴转发）
  const handleCopyLink = useCallback(async () => {
    const link = terracottaInviteLink(shareRoomCode);
    if (!link) return;
    const who = savedName.trim() || "我";
    const text = [
      hosting ? `${who}创建了一个Minecraft房间！` : `${who}邀请你加入Minecraft房间！`,
      `您可以点击链接→ ⟬ ${link} ⟭`,
      `或者复制房间号→ ${shareRoomCode}`,
      `*TIP：你可以使用Koring Launcher、HMCL、PCL CE 加入房间`,
    ].join("\n");
    await navigator.clipboard.writeText(text);
  }, [hosting, savedName, shareRoomCode]);

  // 桌面端两列比例：默认 1:2；加入房间展开时左侧收拢到 0、右侧占满全部 3 份
  return (
    <div className="flex flex-col gap-6">
      {/* 入场动画放在卡片网格上：避免 transform 成为底部固定面板的包含块 */}
      <div
        className={cn(
          "setting-page-enter grid grid-cols-1 items-stretch transition-[grid-template-columns,gap] duration-300 ease-ios",
          joinExpanded
            ? "md:grid-cols-[minmax(0,0fr)_minmax(0,3fr)] md:gap-0"
            : "md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:gap-4",
        )}
      >
        {/* 左：创建房间（整卡点击）；房间内为状态卡（点击关闭/退出） */}
        <button
          type="button"
          onClick={() => void handleHost()}
          disabled={pendingReset || checkingLogin}
          aria-label={inRoom ? (hosting ? "关闭联机房间" : "退出房间") : "创建房间"}
          className={cn(
            SURFACE_CLS,
            HOVER_CLS,
            "group flex min-h-[280px] min-w-0 cursor-pointer flex-col justify-between gap-6 overflow-hidden p-6 text-left",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            "disabled:cursor-wait",
            !inRoom && joinExpanded && "pointer-events-none opacity-0 max-md:hidden",
          )}
        >
          {/*
            内容固定最小宽度：卡片在网格动画里会被压窄，若让文字跟着重新换行，
            整行高度会抖动；这里保持文本排版宽度不变，越界部分由卡片 overflow-hidden 裁掉。
          */}
          {!inRoom && joinExpanded ? null : (
            <div className="flex h-full w-full min-w-[248px] flex-col justify-between gap-6">
              {inRoom ? (
                <>
                  <p className="text-[13px] font-medium leading-relaxed text-foreground">
                    {hosting ? "房间已创建" : "您已加入房间"}
                  </p>
                  <div className="flex items-baseline justify-end gap-2 text-foreground">
                    <span className="text-[44px] font-bold leading-none tracking-[-0.03em]">{onlineCount}</span>
                    <span className="text-[20px] font-semibold leading-none tracking-[-0.02em]">位玩家在线</span>
                  </div>
                </>
              ) : (
                <>
                  <p className="max-w-[24ch] text-[12.5px] leading-relaxed text-muted-foreground">
                    游戏内打开「对局域网开放」，陶瓦会自动识别并生成房间码。
                  </p>
                  <span className="self-end text-right text-[26px] font-bold leading-none tracking-[-0.02em] text-foreground">
                    创建房间
                  </span>
                </>
              )}
            </div>
          )}
        </button>

        {/* 右：加入房间（默认点击展开输入框）／房间内为网络状态 */}
        <div
          className={cn(
            SURFACE_CLS,
            "relative flex min-h-[280px] min-w-0 flex-col gap-5 overflow-hidden p-6",
            !inRoom && !joinExpanded && HOVER_CLS,
            !inRoom && !joinExpanded && "cursor-pointer justify-between gap-6",
          )}
        >
          {inRoom ? (
            <NetworkStatus snapshot={snapshot} />
          ) : (
            <>
              {!joinExpanded ? (
                // 整卡点击展开（覆盖层避免嵌套按钮）
                <button
                  type="button"
                  onClick={() => setJoinExpanded(true)}
                  aria-label="输入房间码加入房间"
                  className="absolute inset-0 z-10 cursor-pointer rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                />
              ) : null}

              <h3 className="text-[26px] font-bold leading-none tracking-[-0.02em] text-foreground">加入房间</h3>

              {joinExpanded ? (
                <>
                  {/* 历史房间：有记录时把卡片撑高，记录 = 房间码 + 房主 + 日期 */}
                  {joinHistory.length > 0 ? (
                    <section className="flex min-h-0 flex-1 flex-col gap-1.5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[11.5px] font-medium text-muted-foreground">历史房间</span>
                        <button
                          type="button"
                          onClick={clearJoinHistory}
                          className="rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors duration-150 ease-spring-soft hover:text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        >
                          清除记录
                        </button>
                      </div>
                      <div className="scroll-area max-h-[220px] min-h-0 overflow-y-auto">
                        {joinHistory.map((entry) => (
                          <button
                            key={entry.code}
                            type="button"
                            onClick={() => setRoom(entry.code)}
                            title="填入该房间码"
                            className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors duration-150 ease-spring-soft hover:bg-foreground/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                          >
                            <span className="min-w-0 flex-1 truncate font-mono text-[12px] tracking-[0.04em] text-foreground">
                              {entry.code}
                            </span>
                            <span className="max-w-[9rem] shrink-0 truncate text-[11px] text-muted-foreground">
                              {entry.hostName || "未知房主"}
                            </span>
                            <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                              {formatJoinedAt(entry.joinedAt)}
                            </span>
                          </button>
                        ))}
                      </div>
                    </section>
                  ) : null}

                  <div className="mt-auto flex flex-col gap-2">
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
                          if (event.key === "Escape") setJoinExpanded(false);
                        }}
                        placeholder="U/XXXX-XXXX-XXXX-XXXX"
                        aria-label="房间码"
                        aria-invalid={roomError !== null}
                        spellCheck={false}
                        autoComplete="off"
                        autoFocus
                        disabled={pendingGuest}
                        className={cn("h-11 font-mono tracking-[0.08em] sm:flex-1", pendingGuest && "cursor-wait")}
                      />
                      <Button variant="primary" className="h-11 shrink-0" onPress={handleJoin} isDisabled={!canJoin}>
                        {pendingGuest ? "正在加入…" : "加入房间"}
                      </Button>
                      <Button
                        variant="outline"
                        className="h-11 shrink-0"
                        onPress={() => setJoinExpanded(false)}
                        isDisabled={pendingGuest}
                      >
                        取消
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <p className="self-end text-[11.5px] leading-relaxed text-muted-foreground">点击输入房间码</p>
              )}
            </>
          )}
        </div>
      </div>

      {/* 吸附在窗口底部的分享邀请面板（房主 / 房间内访客） */}
      {inRoom ? (
        <div className="pointer-events-none fixed bottom-6 right-6 z-30 flex justify-end">
          <div className="pointer-events-auto">
            <ShareInvite
              players={players}
              roomCode={shareRoomCode}
              locale="zh"
              maxExpandedHeight={520}
              closeRoomLabel={hosting ? "关闭房间" : "退出房间"}
              onCloseRoom={handleCloseRoom}
              onCopyRoomCode={handleCopyRoomCode}
              onCopyLink={handleCopyLink}
            />
          </div>
        </div>
      ) : null}
      {/* 版权标识：陶瓦联机（Terracotta）AGPL 例外要求显著标注 */}
      <p className="text-center text-[11px] leading-relaxed text-muted-foreground/80 select-none">
        Powered by{" "}
        <button
          type="button"
          onClick={() => window.electronAPI?.openExternal("https://burningtnt.github.io/Terracotta/")}
          className="underline decoration-dotted underline-offset-2 transition-colors duration-150 ease-spring-soft hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Terracotta
        </button>{" "}
        &amp; Koring Link
        <ServiceStatusBadge className="ml-2 align-middle" />
      </p>
    </div>
  );
}
