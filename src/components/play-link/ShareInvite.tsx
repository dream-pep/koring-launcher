import {
  memo,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
} from "react";
import { useIsDark } from "@/hooks/useIsDark";

export interface SharePlayer {
  /** 唯一 id */
  id: string;
  /** 显示名，如 "Steve" */
  name: string;
  /** 房主 / 访客 */
  role: "host" | "guest";
  /** 可选头像底色，缺省按名字 hash 生成柔和色 */
  color?: string;
}

export interface ShareInviteProps {
  players: SharePlayer[];
  /** 房间码，可能为空字符串 */
  roomCode: string;
  /** 不传则组件内部用 navigator.clipboard.writeText(roomCode) */
  onCopyRoomCode?: () => void | Promise<void>;
  /** 复制网页分享链接（link.koring.space/room?code=…）；不传则该按钮禁用 */
  onCopyLink?: () => void | Promise<void>;
  /** 不传则不渲染踢出按钮 */
  onKick?: (id: string) => void;
  /** 不传则不渲染「关闭房间」按钮 */
  onCloseRoom?: () => void;
  /** 「关闭房间」按钮的标题（访客视角传「退出房间」），默认 zh「关闭房间」/ en「Close room」 */
  closeRoomLabel?: string;
  /** 默认 "zh" */
  locale?: "zh" | "en";
  /** 默认 false：收起态 */
  defaultExpanded?: boolean;
  /** 展开态最高高度，默认 520 */
  maxExpandedHeight?: number;
  className?: string;
}

type Locale = "zh" | "en";
type CopyState = "idle" | "copied" | "error";

/** 几何常量（单位 px），与设计稿一致 */
const PANEL_INSET = 8;
const PANEL_RADIUS = 32;
const CONTENT_TOP = 72;
const FOOTER_HEIGHT = 48;
const FOOTER_GAP = 16;
const PILL_HEIGHT = 48;
const COLLAPSED_HEIGHT = 56;
const COLLAPSED_PILL_HEIGHT = 40;
const COLLAPSED_PILL_WIDTH = 80;
const COLLAPSED_INSET = 8;
const COLLAPSED_RIGHT_INSET = 8;
const NO_AVATAR_INSET = 12;
const CLOSE_SIZE = 48;
const EXPANDED_WIDTH = 320;
const AVATAR_SIZE = 32;
const AVATAR_SLOT_STEP = 21;
const AVATAR_GAP = 10;
const MAX_VISIBLE_SLOTS = 3;
const ROW_HEIGHT = 46;
const HEADING_HEIGHT = 21;
const HEADING_GAP = 10;
/** 展开 / 收起全程时长（毫秒）与缓动，复用 index.css 的动效 token */
const EXPAND_MS = 320;
const COLLAPSE_MS = 280;
const EASE_SOFT = "var(--ease-spring-soft)";
const EASE_SPRING = "var(--ease-spring)";
/** 内容分组进入时的错峰延迟 */
const GROUP_DELAYS = [90, 120, 150, 180];

interface ShareInviteLabels {
  title: string;
  share: string;
  heading: string;
  host: string;
  guest: string;
  kick: string;
  copyLink: string;
  copyLinkTitle: string;
  linkCopied: string;
  linkCopiedAnnounce: string;
  copyRoom: string;
  copied: string;
  retry: string;
  noRoomCode: string;
  close: string;
  closeRoom: string;
  copiedAnnounce: string;
  failedAnnounce: string;
  empty: string;
  members: (count: number) => string;
}

const LABELS: Record<Locale, ShareInviteLabels> = {
  zh: {
    title: "分享「联机房间」",
    share: "分享",
    heading: "拥有访问权限的成员",
    host: "房主",
    guest: "访客",
    kick: "踢出",
    copyLink: "复制链接",
    copyLinkTitle: "复制网页邀请链接（好友点开即可用启动器加入）",
    linkCopied: "链接已复制",
    linkCopiedAnnounce: "邀请链接已复制",
    copyRoom: "复制房间码",
    copied: "已复制",
    retry: "重试",
    noRoomCode: "房间码未生成",
    close: "收起分享面板",
    closeRoom: "关闭房间",
    copiedAnnounce: "房间码已复制",
    failedAnnounce: "复制失败，请重试",
    empty: "还没有成员加入",
    members: (count) => `${count} 位成员`,
  },
  en: {
    title: "Share invite",
    share: "Share",
    heading: "People with access",
    host: "Host",
    guest: "Guest",
    kick: "Kick",
    copyLink: "Copy link",
    copyLinkTitle: "Copy web invite link",
    linkCopied: "Link copied",
    linkCopiedAnnounce: "Invite link copied",
    copyRoom: "Copy room code",
    copied: "Copied",
    retry: "Retry",
    noRoomCode: "No room code yet",
    close: "Collapse share panel",
    closeRoom: "Close room",
    copiedAnnounce: "Room code copied",
    failedAnnounce: "Copy failed, try again",
    empty: "Nobody has joined yet",
    members: (count) => `${count} member${count === 1 ? "" : "s"}`,
  },
};

interface Palette {
  panelBg: string;
  panelBorder: string;
  panelShadow: string;
  pillExpandedBg: string;
  pillExpandedFg: string;
  pillCollapsedBg: string;
  pillCollapsedFg: string;
  text: string;
  subText: string;
  closeHover: string;
  rowHover: string;
  mutedBtnBg: string;
  mutedBtnFg: string;
  successFg: string;
  primaryBtnBg: string;
  primaryBtnFg: string;
  dangerBg: string;
  dangerFg: string;
  avatarRing: string;
}

const LIGHT: Palette = {
  panelBg: "#ffffff",
  panelBorder: "#e5e3df",
  panelShadow: "0 16px 26px -14px rgba(41,39,32,0.16), 0 3px 6px -4px rgba(41,39,32,0.14)",
  pillExpandedBg: "#ecebe4",
  pillExpandedFg: "#23231f",
  pillCollapsedBg: "#20211d",
  pillCollapsedFg: "#ffffff",
  text: "#23231f",
  subText: "#898982",
  closeHover: "#f2f0ec",
  rowHover: "#f8f7f4",
  mutedBtnBg: "#ecebe4",
  mutedBtnFg: "#6f6f67",
  successFg: "#1a7f37",
  primaryBtnBg: "#20211d",
  primaryBtnFg: "#ffffff",
  dangerBg: "#d92d20",
  dangerFg: "#ffffff",
  avatarRing: "#ffffff",
};

const DARK: Palette = {
  panelBg: "#1b1d21",
  panelBorder: "rgba(255,255,255,0.09)",
  panelShadow: "0 20px 34px -18px rgba(0,0,0,0.75), 0 4px 10px -6px rgba(0,0,0,0.6)",
  pillExpandedBg: "rgba(255,255,255,0.08)",
  pillExpandedFg: "#f4f3ef",
  pillCollapsedBg: "#f4f3ef",
  pillCollapsedFg: "#17191d",
  text: "#f4f3ef",
  subText: "#9a9a93",
  closeHover: "rgba(255,255,255,0.09)",
  rowHover: "rgba(255,255,255,0.05)",
  mutedBtnBg: "rgba(255,255,255,0.07)",
  mutedBtnFg: "rgba(255,255,255,0.72)",
  successFg: "#69db7c",
  primaryBtnBg: "#f4f3ef",
  primaryBtnFg: "#17191d",
  dangerBg: "#d92d20",
  dangerFg: "#ffffff",
  avatarRing: "#1b1d21",
};

const AVATAR_TINTS = [
  { light: "#e6dcd0", dark: "#4a3f31" },
  { light: "#d8e3d8", dark: "#334536" },
  { light: "#e0d8e9", dark: "#413a4d" },
  { light: "#e5ded1", dark: "#4a4535" },
  { light: "#d7e1e8", dark: "#2f4048" },
];

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function initials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return trimmed.slice(0, 1).toUpperCase();
}

function avatarTint(player: SharePlayer, dark: boolean): string {
  if (player.color) return player.color;
  const tint = AVATAR_TINTS[hashString(player.name || player.id) % AVATAR_TINTS.length];
  return dark ? tint.dark : tint.light;
}

/** 收起态头像堆叠宽度：26 + (槽位 - 1) × 14 */
function stackWidthFor(slotCount: number): number {
  return slotCount === 0 ? 0 : AVATAR_SIZE + (slotCount - 1) * AVATAR_SLOT_STEP;
}

/** 收起态宽度与胶囊左边距都由头像数量推导 */
export function collapsedWidthFor(avatarCount: number): number {
  const slots = Math.min(avatarCount, MAX_VISIBLE_SLOTS);
  const stack = stackWidthFor(slots);
  const pillLeft = stack === 0 ? NO_AVATAR_INSET : COLLAPSED_INSET + stack + AVATAR_GAP;
  return pillLeft + COLLAPSED_PILL_WIDTH + COLLAPSED_RIGHT_INSET;
}

/** 复制图标（按钮文字右侧） */
function CopyIcon({ size = 14 }: { size?: number }): ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flex: "0 0 auto" }}
    >
      <rect x="9" y="9" width="12" height="12" rx="3" />
      <path d="M5 15V6a3 3 0 0 1 3-3h9" />
    </svg>
  );
}

/** 复制成功后的对勾图标 */
function CheckIcon({ size = 16 }: { size?: number }): ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flex: "0 0 auto" }}
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/** 终止图标（关闭房间按钮文字右侧） */
function StopIcon({ size = 14 }: { size?: number }): ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flex: "0 0 auto" }}
    >
      <rect x="4" y="4" width="16" height="16" rx="3" />
    </svg>
  );
}

function ShareInviteBase({
  players,
  roomCode,
  onCopyRoomCode,
  onCopyLink,
  onKick,
  onCloseRoom,
  closeRoomLabel,
  locale = "zh",
  defaultExpanded = false,
  maxExpandedHeight = 520,
  className,
}: ShareInviteProps) {
  const labels = LABELS[locale];
  const closeRoomText = closeRoomLabel ?? labels.closeRoom;
  const isDark = useIsDark();
  const palette = isDark ? DARK : LIGHT;

  const rootRef = useRef<HTMLDivElement | null>(null);
  const pillRef = useRef<HTMLButtonElement | null>(null);
  const headingRef = useRef<HTMLDivElement | null>(null);
  const rowsRef = useRef<HTMLDivElement | null>(null);

  const [expanded, setExpanded] = useState(defaultExpanded);
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [linkState, setLinkState] = useState<CopyState>("idle");
  const copyTimer = useRef<number | null>(null);
  const linkTimer = useRef<number | null>(null);
  const headingId = useId();

  // 收起态最多三个槽位：超过 3 人时展示 2 个头像 + 「+N」角标
  const visiblePlayers = useMemo(
    () => (players.length > MAX_VISIBLE_SLOTS ? players.slice(0, 2) : players.slice(0, MAX_VISIBLE_SLOTS)),
    [players],
  );
  const overflowCount = players.length > MAX_VISIBLE_SLOTS ? players.length - 2 : 0;
  const slotCount = visiblePlayers.length + (overflowCount > 0 ? 1 : 0);
  const stackWidth = stackWidthFor(slotCount);
  const collapsedPillLeft = stackWidth === 0 ? NO_AVATAR_INSET : COLLAPSED_INSET + stackWidth + AVATAR_GAP;
  const collapsedWidth = collapsedPillLeft + COLLAPSED_PILL_WIDTH + COLLAPSED_RIGHT_INSET;

  const maxContentHeight = Math.max(0, maxExpandedHeight - CONTENT_TOP - FOOTER_GAP - FOOTER_HEIGHT - PANEL_INSET);
  const [contentHeight, setContentHeight] = useState(() =>
    Math.min(maxContentHeight, HEADING_HEIGHT + HEADING_GAP + players.length * ROW_HEIGHT),
  );

  const expandedHeight = CONTENT_TOP + contentHeight + FOOTER_GAP + FOOTER_HEIGHT + PANEL_INSET;
  const width = expanded ? EXPANDED_WIDTH : collapsedWidth;
  const height = expanded ? expandedHeight : COLLAPSED_HEIGHT;
  const duration = expanded ? EXPAND_MS : COLLAPSE_MS;

  // 内容高度 = 标题 + 成员行（受最高高度约束，超出滚动）
  useLayoutEffect(() => {
    const heading = headingRef.current;
    const rows = rowsRef.current;
    if (!heading || !rows) return;

    const measure = () => {
      const natural = heading.offsetHeight + HEADING_GAP + rows.scrollHeight;
      setContentHeight((previous) => {
        const next = Math.min(natural, maxContentHeight);
        return Math.abs(next - previous) < 0.5 ? previous : next;
      });
    };

    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(heading);
    observer.observe(rows);
    return () => observer.disconnect();
  }, [players.length, locale, expanded, maxContentHeight]);

  useEffect(() => {
    return () => {
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
    };
  }, []);

  // 展开时点击空白区域收起 + Escape 收起
  useEffect(() => {
    if (!expanded) return;

    const handlePointerDown = (event: PointerEvent) => {
      const root = rootRef.current;
      if (!root) return;
      if (event.target instanceof Node && root.contains(event.target)) return;
      setExpanded(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setExpanded(false);
      pillRef.current?.focus();
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [expanded]);

  const handleCopyRoom = useCallback(async () => {
    if (!roomCode) return;
    try {
      if (onCopyRoomCode) await onCopyRoomCode();
      else await navigator.clipboard.writeText(roomCode);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
    if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => setCopyState("idle"), 1800);
  }, [onCopyRoomCode, roomCode]);

  const copyRoomLabel =
    copyState === "copied"
      ? labels.copied
      : copyState === "error"
        ? labels.retry
        : roomCode
          ? labels.copyRoom
          : labels.noRoomCode;

  const handleCopyLink = useCallback(async () => {
    if (!onCopyLink) return;
    try {
      await onCopyLink();
      setLinkState("copied");
    } catch {
      setLinkState("error");
    }
    if (linkTimer.current !== null) window.clearTimeout(linkTimer.current);
    linkTimer.current = window.setTimeout(() => setLinkState("idle"), 1800);
  }, [onCopyLink]);

  const copyLinkLabel =
    linkState === "copied"
      ? labels.linkCopied
      : linkState === "error"
        ? labels.retry
        : labels.copyLink;

  /** 内容分组统一进入 / 离开：位移 + 透明度 + 模糊，展开时按顺序错峰 */
  const groupStyle = (index: number, props: CSSProperties = {}): CSSProperties => {
    const delay = expanded ? GROUP_DELAYS[index] ?? 0 : 0;
    return {
      opacity: expanded ? 1 : 0,
      transform: `translate3d(0, ${expanded ? 0 : 10}px, 0)`,
      filter: expanded ? "none" : "blur(3px)",
      pointerEvents: expanded ? "auto" : "none",
      transition: [
        `opacity ${duration}ms ${EASE_SOFT} ${delay}ms`,
        `transform ${duration}ms ${EASE_SOFT} ${delay}ms`,
        `filter ${duration}ms ${EASE_SOFT} ${delay}ms`,
      ].join(", "),
      ...props,
    };
  };

  return (
    <div
      ref={rootRef}
      className={className}
      style={{
        position: "relative",
        overflow: "hidden",
        width,
        height,
        borderRadius: PANEL_RADIUS,
        border: `1px solid ${palette.panelBorder}`,
        background: palette.panelBg,
        boxShadow: palette.panelShadow,
        // 展开与收起使用 index.css 里的 spring token，宽度、高度分别走同一条过渡
        transition: `width ${duration}ms ${EASE_SOFT}, height ${duration}ms ${EASE_SOFT}, background-color 200ms ${EASE_SOFT}, border-color 200ms ${EASE_SOFT}`,
      }}
    >
      {/* 收起态头像堆叠：位置由头像数量决定 */}
      <div
        style={{
          position: "absolute",
          left: COLLAPSED_INSET,
          top: 0,
          height: COLLAPSED_HEIGHT,
          display: "flex",
          alignItems: "center",
          width: stackWidth,
          opacity: expanded ? 0 : 1,
          transform: `translate3d(${expanded ? -8 : 0}px, 0, 0)`,
          transition: `opacity 180ms ${EASE_SOFT}, transform 180ms ${EASE_SOFT}`,
          pointerEvents: "none",
        }}
        aria-hidden
      >
        {visiblePlayers.map((player, index) => (
          <span
            key={player.id}
            style={{
              width: AVATAR_SIZE,
              height: AVATAR_SIZE,
              marginLeft: index === 0 ? 0 : -(AVATAR_SIZE - AVATAR_SLOT_STEP),
              borderRadius: 999,
              border: `2px solid ${palette.avatarRing}`,
              background: avatarTint(player, isDark),
              color: isDark ? "#f4f3ef" : "#3b3a33",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "-0.01em",
              flex: "0 0 auto",
            }}
          >
            {initials(player.name)}
          </span>
        ))}
        {overflowCount > 0 ? (
          <span
            style={{
              width: AVATAR_SIZE,
              height: AVATAR_SIZE,
              marginLeft: -(AVATAR_SIZE - AVATAR_SLOT_STEP),
              borderRadius: 999,
              border: `2px solid ${palette.avatarRing}`,
              background: palette.mutedBtnBg,
              color: palette.text,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10,
              fontWeight: 600,
              flex: "0 0 auto",
            }}
          >
            +{overflowCount}
          </span>
        ) : null}
      </div>

      {/* 标题胶囊：同一个元素在展开 / 收起之间连续形变 */}
      <button
        ref={pillRef}
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        aria-controls={headingId}
        style={{
          position: "absolute",
          left: expanded ? PANEL_INSET : collapsedPillLeft,
          top: expanded ? PANEL_INSET : (COLLAPSED_HEIGHT - COLLAPSED_PILL_HEIGHT) / 2,
          width: expanded ? EXPANDED_WIDTH - PANEL_INSET * 2 - CLOSE_SIZE - PANEL_INSET : COLLAPSED_PILL_WIDTH,
          height: expanded ? PILL_HEIGHT : COLLAPSED_PILL_HEIGHT,
          display: "flex",
          alignItems: "center",
          justifyContent: expanded ? "flex-start" : "center",
          gap: expanded ? 8 : 6,
          padding: expanded ? "0 16px" : "0 8px",
          border: "none",
          borderRadius: 999,
          background: expanded ? palette.pillExpandedBg : palette.pillCollapsedBg,
          color: expanded ? palette.pillExpandedFg : palette.pillCollapsedFg,
          cursor: "pointer",
          overflow: "hidden",
          whiteSpace: "nowrap",
          transition: `left ${duration}ms ${EASE_SPRING}, top ${duration}ms ${EASE_SPRING}, width ${duration}ms ${EASE_SPRING}, height ${duration}ms ${EASE_SPRING}, padding 200ms ${EASE_SOFT}, background-color 200ms ${EASE_SOFT}, color 200ms ${EASE_SOFT}`,
        }}
      >
        <svg
          width={expanded ? 16 : 13}
          height={expanded ? 16 : 13}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          style={{ flex: "0 0 auto", transition: `width 200ms ${EASE_SOFT}, height 200ms ${EASE_SOFT}` }}
        >
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
        </svg>
        <span
          style={{
            fontSize: expanded ? 16 : 13,
            fontWeight: 600,
            letterSpacing: expanded ? "-0.35px" : 0,
            transition: `font-size 200ms ${EASE_SOFT}, letter-spacing 200ms ${EASE_SOFT}`,
          }}
        >
          {expanded ? labels.title : labels.share}
        </span>
      </button>

      {/* 收起按钮（展开态可见） */}
      <div
        style={groupStyle(0, {
          position: "absolute",
          top: PANEL_INSET,
          right: PANEL_INSET,
          width: CLOSE_SIZE,
          height: CLOSE_SIZE,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        })}
      >
        <button
          type="button"
          onClick={() => setExpanded(false)}
          aria-label={labels.close}
          style={{
            width: CLOSE_SIZE,
            height: CLOSE_SIZE,
            borderRadius: 999,
            border: "none",
            background: "transparent",
            color: palette.subText,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: `background-color 140ms ${EASE_SOFT}, color 140ms ${EASE_SOFT}`,
          }}
          onPointerEnter={(event) => {
            event.currentTarget.style.background = palette.closeHover;
            event.currentTarget.style.color = palette.text;
          }}
          onPointerLeave={(event) => {
            event.currentTarget.style.background = "transparent";
            event.currentTarget.style.color = palette.subText;
          }}
        >
          <CloseIcon />
        </button>
      </div>

      {/* 内容区：标题 + 可滚动成员列表 */}
      <div
        id={headingId}
        style={groupStyle(1, {
          position: "absolute",
          left: PANEL_INSET,
          right: PANEL_INSET,
          top: CONTENT_TOP,
          height: contentHeight,
          display: "flex",
          flexDirection: "column",
          gap: HEADING_GAP,
          overflow: "hidden",
        })}
      >
        <div
          ref={headingRef}
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 8,
            flex: "0 0 auto",
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: "-0.01em", color: palette.text }}>
            {labels.heading}
          </span>
          <span style={{ fontSize: 12, color: palette.subText }}>{labels.members(players.length)}</span>
        </div>

        <div
          style={{
            flex: "1 1 auto",
            minHeight: 0,
            overflowY: "auto",
            overscrollBehavior: "contain",
            marginRight: -6,
            paddingRight: 6,
          }}
        >
          <div ref={rowsRef} style={{ display: "flex", flexDirection: "column" }}>
            {players.length === 0 ? (
              <p style={{ margin: 0, padding: "10px 0", fontSize: 13, color: palette.subText }}>{labels.empty}</p>
            ) : (
              players.map((player, index) => (
                <PlayerRow
                  key={player.id}
                  index={index}
                  player={player}
                  labels={labels}
                  palette={palette}
                  dark={isDark}
                  onKick={onKick}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* 底部按钮：复制链接（主）/ 复制房间码（次）/ 关闭房间（最右） */}
      <div
        style={groupStyle(3, {
          position: "absolute",
          left: PANEL_INSET,
          right: PANEL_INSET,
          bottom: PANEL_INSET,
          height: FOOTER_HEIGHT,
          display: "flex",
          alignItems: "center",
          gap: 8,
        })}
      >
        <button
          type="button"
          onClick={() => void handleCopyLink()}
          title={labels.copyLinkTitle}
          aria-live="polite"
          style={{
            height: 44,
            padding: "0 8px",
            flex: "1 1 0",
            minWidth: 0,
            borderRadius: 999,
            border: "none",
            background: palette.primaryBtnBg,
            color: palette.primaryBtnFg,
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            transition: `filter 140ms ${EASE_SOFT}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
          onPointerEnter={(event) => {
            event.currentTarget.style.filter = "brightness(1.08)";
          }}
          onPointerLeave={(event) => {
            event.currentTarget.style.filter = "none";
          }}
        >
          {linkState === "copied" ? <CheckIcon size={15} /> : null}
          {copyLinkLabel}
        </button>

        <button
          type="button"
          onClick={() => void handleCopyRoom()}
          title={copyRoomLabel}
          aria-label={copyRoomLabel}
          aria-live="polite"
          style={{
            height: 44,
            width: 44,
            flex: "0 0 44px",
            borderRadius: 999,
            border: "none",
            background: palette.mutedBtnBg,
            color: copyState === "copied" ? palette.successFg : palette.mutedBtnFg,
            cursor: "pointer",
            transition: `filter 140ms ${EASE_SOFT}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onPointerEnter={(event) => {
            event.currentTarget.style.filter = "brightness(0.96)";
          }}
          onPointerLeave={(event) => {
            event.currentTarget.style.filter = "none";
          }}
        >
          {copyState === "copied" ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
        </button>

        {onCloseRoom ? (
          <button
            type="button"
            onClick={onCloseRoom}
            title={closeRoomText}
            aria-label={closeRoomText}
            style={{
              height: 44,
              width: 44,
              flex: "0 0 44px",
              borderRadius: 999,
              border: "none",
              background: palette.dangerBg,
              color: palette.dangerFg,
              cursor: "pointer",
              transition: `filter 140ms ${EASE_SOFT}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onPointerEnter={(event) => {
              event.currentTarget.style.filter = "brightness(1.08)";
            }}
            onPointerLeave={(event) => {
              event.currentTarget.style.filter = "none";
            }}
          >
            <StopIcon size={16} />
          </button>
        ) : null}
      </div>

      <span
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          overflow: "hidden",
          clip: "rect(0 0 0 0)",
          whiteSpace: "nowrap",
        }}
      >
        {copyState === "copied"
          ? labels.copiedAnnounce
          : copyState === "error"
            ? labels.failedAnnounce
            : linkState === "copied"
              ? labels.linkCopiedAnnounce
              : linkState === "error"
                ? labels.failedAnnounce
                : ""}
      </span>
    </div>
  );
}

interface PlayerRowProps {
  player: SharePlayer;
  index: number;
  labels: ShareInviteLabels;
  palette: Palette;
  dark: boolean;
  onKick?: (id: string) => void;
}

function PlayerRow({ player, index, labels, palette, dark, onKick }: PlayerRowProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="animate-list-item-in"
      // 新成员加入时按顺序淡入，复用 index.css 的 list-item-in 关键帧
      style={{ animationDelay: `${index * 35}ms` }}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      <div
        style={{
          height: ROW_HEIGHT,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "0 6px",
          borderRadius: 12,
          background: hovered ? palette.rowHover : "transparent",
          transition: `background-color 140ms ${EASE_SOFT}`,
        }}
      >
        <span
          style={{
            width: 32,
            height: 32,
            flex: "0 0 auto",
            borderRadius: 999,
            background: avatarTint(player, dark),
            color: dark ? "#f4f3ef" : "#3b3a33",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {initials(player.name)}
        </span>
        <span
          style={{
            flex: "1 1 auto",
            minWidth: 0,
            fontSize: 15,
            fontWeight: 500,
            color: palette.text,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {player.name}
        </span>
        {onKick && hovered ? (
          <button
            type="button"
            onClick={() => onKick(player.id)}
            style={{
              flex: "0 0 auto",
              height: 28,
              padding: "0 10px",
              borderRadius: 999,
              border: "none",
              background: palette.dangerBg,
              color: palette.dangerFg,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              transition: `filter 140ms ${EASE_SOFT}`,
            }}
            onPointerEnter={(event) => {
              event.currentTarget.style.filter = "brightness(0.96)";
            }}
            onPointerLeave={(event) => {
              event.currentTarget.style.filter = "none";
            }}
          >
            {labels.kick}
          </button>
        ) : (
          <span style={{ flex: "0 0 auto", fontSize: 13, color: palette.subText }}>
            {player.role === "host" ? labels.host : labels.guest}
          </span>
        )}
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

/**
 * 底部常驻分享面板。
 * 主进程每 500ms 广播一次状态（延迟/成员），用 memo 挡住与面板无关的刷新，
 * 只有 players / roomCode / 回调变化时才重新渲染；玩家变动会立即反映到列表与高度。
 */
export const ShareInvite = memo(ShareInviteBase);
