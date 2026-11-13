import { useEffect, useState } from "react";
import { Gamepad2, Loader2 } from "lucide-react";
import { AccountAvatar } from "./AccountAvatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
} from "@/components/ui/select";
import { ACCOUNT_TYPE_LABELS, minecraftAccountAvatar, minecraftAccountSkin } from "@/lib/minecraft-account";
import { useAuthStore } from "@/stores/authStore";
import { useRouteStore } from "@/stores/routeStore";
import { cn } from "@/lib/utils";
import type { AuthAccount } from "@/api/auth-registry";

/**
 * 首页左上角的 Minecraft 游戏账户卡片。
 *
 * - 头像区：当前账户使用大头像，另外把「靠前的两个非选中账户」缩成一半大小，
 *   排在大头像右下角、被大头像遮住一部分（最多显示 3 个账户的头像）。
 * - 点击卡片向下展开账户下拉框，可直接切换当前游戏账户（不再跳设置页，也没有箭头）。
 * - 宽度随用户名自适应（过长时截断）。
 * - 启动器每次启动后第一次显示时先问候「欢迎回来，xxx。」，3 秒后淡回账户与账户属性。
 */

/** 每个启动器会话只问候一次（组件重新挂载不重复问候） */
let greetedThisLaunch = false;
const GREETING_MS = 3000;
/** 问候语退场动画时长（与 --animate-pop-out 一致） */
const GREETING_EXIT_MS = 200;

/** 当前账户大头像尺寸（缩小头像 = 一半） */
const AVATAR_SIZE = 40;
const EXTRA_AVATAR_SIZE = AVATAR_SIZE / 2;

/** 下拉框里「管理账户…」的哨兵值，不参与账户切换 */
const MANAGE_ACCOUNTS_VALUE = "__manage_accounts__";

const triggerClassName =
  "group h-auto w-auto cursor-pointer justify-start gap-3 rounded-none border-0 bg-transparent p-0 text-left transition-[color,scale] duration-200 ease-spring-soft outline-none hover:border-0 focus-visible:border-0 focus-visible:ring-0 active:scale-[0.99] dark:bg-transparent";

const avatarFrameClassName =
  "bg-white/85 text-foreground/60 backdrop-blur-[12px] dark:bg-black/45";

/** 当前账户大头像 + 最多两个非选中账户的缩小头像（右下角、叠在大头像后面）。 */
function AccountAvatarCluster({
  active,
  extras,
}: {
  active: AuthAccount;
  extras: AuthAccount[];
}) {
  return (
    <span className="flex shrink-0 items-center">
      {/* 大头像在最左侧，负责遮住右侧缩小头像的左半边 */}
      <span className="relative z-30 block shrink-0">
        <AccountAvatar
          picture={minecraftAccountAvatar(active)}
          skin={minecraftAccountSkin(active)}
          name={active.username}
          size={AVATAR_SIZE}
          alt={active.username}
          frameClassName={avatarFrameClassName}
          className="ring-2 ring-white/25 dark:ring-black/35"
        />
      </span>
      {extras.map((account, index) => (
        <span
          key={account.id}
          aria-hidden
          className={cn(
            "relative block shrink-0 translate-y-[9px]",
            index === 0 ? "z-20 -ml-2.5" : "z-10 -ml-2",
          )}
        >
          <AccountAvatar
            picture={minecraftAccountAvatar(account)}
            skin={minecraftAccountSkin(account)}
            name={account.username}
            size={EXTRA_AVATAR_SIZE}
            alt=""
            frameClassName={avatarFrameClassName}
            className="ring-2 ring-white/25 dark:ring-black/35"
          />
        </span>
      ))}
    </span>
  );
}

export function MinecraftAccountCard({ className }: { className?: string }) {
  const accounts = useAuthStore((s) => s.accounts);
  const activeAccountId = useAuthStore((s) => s.activeAccountId);
  const loading = useAuthStore((s) => s.loading);
  const initFromRegistry = useAuthStore((s) => s.initFromRegistry);
  const setActiveAccount = useAuthStore((s) => s.setActiveAccount);
  const navigate = useRouteStore((s) => s.navigate);
  const setSettingsSection = useRouteStore((s) => s.setSettingsSection);

  const active = accounts.find((account) => account.id === activeAccountId) ?? null;
  /** 启动后第一次显示时的问候语：in（入场动画）→ out（退场动画）→ 关闭 */
  const [greetingPhase, setGreetingPhase] = useState<"idle" | "in" | "out">("idle");
  const greeting = greetingPhase !== "idle";

  // App 启动时已初始化过一次；这里兜底（页面重载 / store 为空时补读）
  useEffect(() => {
    if (accounts.length === 0) void initFromRegistry();
  }, [accounts.length, initFromRegistry]);

  // 启动器本次运行的第一次显示：大字问候「欢迎回来，xxx。」
  useEffect(() => {
    if (!active || greetedThisLaunch) return;
    greetedThisLaunch = true;
    setGreetingPhase("in");
  }, [active]);

  // 用阶段机推进问候语：in →（3s）→ out →（200ms）→ idle
  // 每个阶段各自计时，避免 StrictMode 双次执行 / active 变化把计时器清掉而卡在问候态
  useEffect(() => {
    if (greetingPhase === "idle") return;
    const next = greetingPhase === "in" ? "out" : "idle";
    const delay = greetingPhase === "in" ? GREETING_MS : GREETING_EXIT_MS;
    const timer = window.setTimeout(() => setGreetingPhase(next), delay);
    return () => window.clearTimeout(timer);
  }, [greetingPhase]);

  const openGameAccount = () => {
    // 指定设置页的分区，进入设置后直接停在「游戏账户&档案」
    setSettingsSection("game-account");
    navigate("setting");
  };

  if (loading && accounts.length === 0) {
    return (
      <div className={cn("flex items-center gap-2.5", className)}>
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-white/45" />
        <span className="text-[12.5px] text-white/60">账户加载中…</span>
      </div>
    );
  }

  // 完全没有游戏账户：引导去设置页添加
  if (accounts.length === 0) {
    return (
      <button
        type="button"
        onClick={openGameAccount}
        title="添加或登录 Minecraft 游戏账户"
        className={cn(
          "group flex max-w-[300px] items-center gap-3 text-left",
          "transition-[translate,color,scale] duration-200 ease-spring-soft active:scale-[0.99]",
          className,
        )}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/85 text-foreground/50 backdrop-blur-[12px] dark:bg-black/45">
          <Gamepad2 className="h-4.5 w-4.5" strokeWidth={1.8} />
        </span>
        <span className="min-w-0">
          <span className="text-shadow-overlay block truncate text-[13.5px] font-medium leading-tight text-white/85">
            添加 Minecraft 账户
          </span>
          <span className="text-shadow-overlay mt-0.5 block truncate text-[11px] leading-tight text-white/50">
            离线 / LittleSkin / 微软
          </span>
        </span>
      </button>
    );
  }

  // 有账户：当前账户大头像 + 两个缩小头像；点击向下弹出账户下拉框
  const extras = active
    ? accounts.filter((account) => account.id !== active.id).slice(0, 2)
    : [];

  return (
    <Select
      value={active?.id ?? null}
      onValueChange={(value) => {
        if (value === MANAGE_ACCOUNTS_VALUE) {
          openGameAccount();
          return;
        }
        if (value) void setActiveAccount(value);
      }}
    >
      <SelectTrigger
        aria-label={active ? "切换 Minecraft 游戏账户" : "选择 Minecraft 游戏账户"}
        title={
          active
            ? `${active.username}\n${ACCOUNT_TYPE_LABELS[active.type]}\n点击切换游戏账户`
            : "选择 Minecraft 游戏账户"
        }
        className={cn(triggerClassName, className)}
      >
        {active ? (
          <AccountAvatarCluster active={active} extras={extras} />
        ) : (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/85 text-foreground/50 backdrop-blur-[12px] dark:bg-black/45">
            <Gamepad2 className="h-4.5 w-4.5" strokeWidth={1.8} />
          </span>
        )}

        <span className="min-w-0 max-w-[320px]">
          {active ? (
            greeting ? (
              /* 启动后第一次显示：大字体问候，入场/退场均使用 index.css 里的 CSS 动画 */
              <span
                className={cn(
                  "text-shadow-overlay block truncate text-[20px] font-semibold leading-tight text-white",
                  greetingPhase === "out" ? "animate-pop-out" : "animate-pop-in",
                )}
              >
                欢迎回来，{active.username}。
              </span>
            ) : (
              <>
                <span className="text-shadow-overlay block truncate text-[14px] font-semibold leading-tight text-white">
                  {active.username}
                </span>
                <span className="text-shadow-overlay mt-1 block truncate text-[11.5px] leading-tight text-white/55">
                  {ACCOUNT_TYPE_LABELS[active.type]}
                </span>
              </>
            )
          ) : (
            <>
              <span className="text-shadow-overlay block truncate text-[13.5px] font-medium leading-tight text-white/85">
                选择 Minecraft 账户
              </span>
              <span className="text-shadow-overlay mt-0.5 block truncate text-[11px] leading-tight text-white/50">
                已有 {accounts.length} 个账户，点击切换
              </span>
            </>
          )}
        </span>
      </SelectTrigger>

      <SelectContent side="bottom" sideOffset={8} className="w-[220px] min-w-[220px]">
        {accounts.map((account) => (
          <SelectItem key={account.id} value={account.id} className="gap-2.5">
            <span className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
              <AccountAvatar
                picture={minecraftAccountAvatar(account)}
                skin={minecraftAccountSkin(account)}
                name={account.username}
                size={22}
                alt=""
                frameClassName="bg-foreground/[0.08] text-foreground/60"
              />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate">{account.username}</span>
                <span className="truncate text-[11px] text-muted-foreground">
                  {ACCOUNT_TYPE_LABELS[account.type]}
                </span>
              </span>
            </span>
          </SelectItem>
        ))}
        <SelectSeparator />
        <SelectItem value={MANAGE_ACCOUNTS_VALUE}>管理账户…</SelectItem>
      </SelectContent>
    </Select>
  );
}
