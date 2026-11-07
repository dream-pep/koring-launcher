import { useEffect } from "react";
import { ChevronRight, Gamepad2, Loader2 } from "lucide-react";
import { AccountAvatar } from "./AccountAvatar";
import { FadeText } from "@/components/ui/fade-text";
import { ACCOUNT_TYPE_LABELS, minecraftAccountAvatar } from "@/lib/minecraft-account";
import { useAuthStore } from "@/stores/authStore";
import { useRouteStore } from "@/stores/routeStore";
import { cn } from "@/lib/utils";

/**
 * 首页左上角的 Minecraft 游戏账户卡片。
 *
 * 排版与设置页侧边栏顶部的 Koring 账户卡一致（48px 头像 + 昵称 + 副标题 + 箭头），
 * 但数据来自 useAuthStore（离线 / LittleSkin / 微软「游戏账户」），
 * 点击进入 设置 → 游戏账户&档案。
 */
export function MinecraftAccountCard({ className }: { className?: string }) {
  const accounts = useAuthStore((s) => s.accounts);
  const activeAccountId = useAuthStore((s) => s.activeAccountId);
  const loading = useAuthStore((s) => s.loading);
  const initFromRegistry = useAuthStore((s) => s.initFromRegistry);
  const navigate = useRouteStore((s) => s.navigate);
  const setSettingsSection = useRouteStore((s) => s.setSettingsSection);

  const active = accounts.find((account) => account.id === activeAccountId) ?? null;

  // App 启动时已初始化过一次；这里兜底（页面重载 / store 为空时补读）
  useEffect(() => {
    if (accounts.length === 0) void initFromRegistry();
  }, [accounts.length, initFromRegistry]);

  const openGameAccount = () => {
    // 指定设置页的分区，进入设置后直接停在「游戏账户&档案」
    setSettingsSection("game-account");
    navigate("setting");
  };

  if (loading && accounts.length === 0) {
    return (
      <div className={cn("flex w-[248px] items-center gap-2.5", className)}>
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-white/45" />
        <span className="text-[12.5px] text-white/60">账户加载中…</span>
      </div>
    );
  }

  // 未添加游戏账户 / 有账户但未选中：引导去设置页添加或切换
  if (!active) {
    const hasAccounts = accounts.length > 0;
    return (
      <button
        type="button"
        onClick={openGameAccount}
        title={hasAccounts ? "选择 Minecraft 游戏账户" : "添加或登录 Minecraft 游戏账户"}
        className={cn(
          "group flex w-[248px] items-center gap-3 text-left",
          "transition-[translate,color,scale] duration-200 ease-spring-soft active:scale-[0.99]",
          className,
        )}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/85 text-foreground/50 backdrop-blur-[12px] dark:bg-black/45">
          <Gamepad2 className="h-4.5 w-4.5" strokeWidth={1.8} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="text-shadow-overlay block truncate text-[13.5px] font-medium leading-tight text-white/85">
            {hasAccounts ? "选择 Minecraft 账户" : "添加 Minecraft 账户"}
          </span>
          <span className="text-shadow-overlay mt-0.5 block truncate text-[11px] leading-tight text-white/50">
            {hasAccounts ? `已有 ${accounts.length} 个账户，点击管理` : "离线 / LittleSkin / 微软"}
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-white/25 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-white/45" />
      </button>
    );
  }

  const typeLabel = ACCOUNT_TYPE_LABELS[active.type];

  return (
    <button
      type="button"
      onClick={openGameAccount}
      title={`${active.username}\n${typeLabel}\n点击管理游戏账户`}
      className={cn(
        "group flex w-[248px] items-center gap-3 text-left",
        "transition-[translate,color,scale] duration-200 ease-spring-soft active:scale-[0.99]",
        className,
      )}
    >
      <AccountAvatar
        picture={minecraftAccountAvatar(active)}
        name={active.username}
        size={40}
        alt={active.username}
        frameClassName="bg-white/85 text-foreground/60 backdrop-blur-[12px] dark:bg-black/45"
      />
      <span className="min-w-0 flex-1">
        <span className="text-shadow-overlay block truncate text-[14px] font-semibold leading-tight text-white">
          <FadeText value={active.username} />
        </span>
        <span className="text-shadow-overlay mt-1 block truncate text-[11.5px] leading-tight text-white/55">
          <FadeText value={typeLabel} />
        </span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-white/25 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-white/45" />
    </button>
  );
}
