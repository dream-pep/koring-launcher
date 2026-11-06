import { AccountAvatar } from "@/components/account/AccountAvatar";
import { useKoringAuthStore } from "@/stores/koringAuthStore";
import { Loader2 } from "lucide-react";

/**
 * Account 账户页：
 * 顶栏头像点击进入（路由 key = "account"，二级页）。
 * 目前只放账户身份概览 + 占位区，具体内容待定。
 */
export function AccountPage() {
  const user = useKoringAuthStore((s) => s.user);
  const loading = useKoringAuthStore((s) => s.loading);

  const name = user?.name || user?.username || "";

  return (
    <div className="h-full overflow-y-auto scroll-area p-6">
      <div className="mx-auto w-full max-w-3xl">
        <h1 className="text-xl font-bold text-foreground">账户</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">Account · 账号中心</p>

        {/* 身份概览：头像 / 昵称 / 邮箱 */}
        <div className="mt-6 flex items-center gap-4 rounded-2xl border border-border/40 bg-white/70 px-5 py-4 backdrop-blur-sm dark:border-white/[0.08] dark:bg-black/25">
          <AccountAvatar picture={user?.picture} name={name} size={56} />

          <div className="min-w-0 flex-1">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                加载中...
              </div>
            ) : user ? (
              <>
                <p className="truncate text-base font-medium text-foreground">{name}</p>
                <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                  {user.email || "Koring 账户"}
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-foreground">未登录</p>
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  登录 Koring 账户后可在此查看账号信息
                </p>
              </>
            )}
          </div>
        </div>

        {/* 占位：页面内容待定 */}
        <div className="mt-6 flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border/40 py-16 text-center dark:border-white/[0.08]">
          <p className="text-sm text-muted-foreground">页面内容待补充</p>
          <p className="text-[12px] text-muted-foreground/60">
            Account 页面的功能区块将在这里添加
          </p>
        </div>
      </div>
    </div>
  );
}
