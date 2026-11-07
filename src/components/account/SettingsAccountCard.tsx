import { useEffect } from "react";
import { ChevronRight, Loader2, LogIn } from "lucide-react";
import { AccountAvatar } from "./AccountAvatar";
import { useKoringAuthStore } from "@/stores/koringAuthStore";
import { useRouteStore } from "@/stores/routeStore";

/**
 * 设置页侧边栏顶部的 Koring 账户卡片（与 Minecraft 账户无关）。
 * - 已登录：头像 + 昵称 + @用户名；点击打开「账户」页
 * - 未登录：头像占位 + 「登录 Koring Account」提示；点击同样先打开「账户」页（页内再点登录）
 * - 读取中：占位一行加载提示
 */
export function SettingsAccountCard({ onOpenAccount }: { onOpenAccount?: () => void }) {
  const user = useKoringAuthStore((s) => s.user);
  const loading = useKoringAuthStore((s) => s.loading);
  const initFromDisk = useKoringAuthStore((s) => s.initFromDisk);
  const navigate = useRouteStore((s) => s.navigate);

  // 启动时 App 已调用过一次；这里兜底：未登录且不在加载中时再读一次本地凭证
  useEffect(() => {
    if (!user) void initFromDisk();
  }, [user, initFromDisk]);

  // 卡片统一去「账户」页；没有传入回调时（组件被单独使用）退回登录页
  const openAccount = () => {
    if (onOpenAccount) onOpenAccount();
    else navigate("setting/login");
  };

  if (loading && !user) {
    return (
      <div className="mb-5 flex items-center gap-2.5 px-2 py-1.5">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-foreground/35" />
        <span className="text-[12.5px] text-foreground/50">账户加载中…</span>
      </div>
    );
  }

  if (!user) {
    return (
      <button
        type="button"
        onClick={openAccount}
        title="查看 Koring Account"
        className="mb-5 flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-[translate,color,background-color,scale] duration-200 ease-spring-soft hover:bg-foreground/[0.05] active:scale-[0.99]"
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-foreground/[0.07] text-foreground/45">
          <LogIn className="h-5 w-5" strokeWidth={1.8} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-medium leading-tight text-foreground/80">
            登录 Koring Account
          </span>
          <span className="mt-0.5 block truncate text-[11px] leading-tight text-muted-foreground/70">
            点击查看账户信息
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-foreground/25" />
      </button>
    );
  }

  const name = user.name || user.username || "Koring 账户";
  const handle = user.username ? `@${user.username}` : "";

  return (
    <button
      type="button"
      onClick={openAccount}
      title={handle ? `${name}\n${handle}\n点击查看账户信息` : `${name}\n点击查看账户信息`}
      className="group mb-5 flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-[translate,color,background-color,scale] duration-200 ease-spring-soft hover:bg-foreground/[0.05] active:scale-[0.99]"
    >
      <AccountAvatar picture={user.picture} name={name} size={48} alt={name} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-semibold leading-tight text-foreground">
          {name}
        </span>
        <span className="mt-1 block truncate text-[11.5px] leading-tight text-muted-foreground/70">
          {handle || "Koring 账户"}
        </span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-foreground/25 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-foreground/40" />
    </button>
  );
}
