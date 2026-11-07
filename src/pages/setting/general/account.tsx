import { useEffect } from "react";
import { AtSign, Fingerprint, Loader2, LogIn, LogOut, Mail } from "lucide-react";
import { AccountAvatar } from "@/components/account/AccountAvatar";
import { Button } from "@/components/ui/button";
import { PageHeader, SectionTitle, SettingCard, SettingRow } from "@/components/setting";
import { toast } from "@/lib/toast";
import { useConfirmDialogStore } from "@/stores/confirmDialogStore";
import { useKoringAuthStore } from "@/stores/koringAuthStore";
import { useRouteStore } from "@/stores/routeStore";

/** 单条账户资料：图标 + 字段名 + 值（值过长时截断，悬停看全文） */
function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-foreground/[0.05] text-foreground/45">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11.5px] leading-tight text-muted-foreground/70">{label}</p>
        <p className="mt-0.5 truncate text-[13.5px] font-medium text-foreground" title={value}>
          {value || "—"}
        </p>
      </div>
    </div>
  );
}

/**
 * 设置 → 账户：展示 Koring Account 的资料（与 Minecraft 账户无关），并提供退出登录。
 * - 未登录：提示 + 「登录 Koring Account」按钮（跳登录页）
 * - 已登录：头像 / 昵称 / 邮箱 / 用户名 / 账户 ID + 退出登录
 */
export function AccountSetting() {
  const user = useKoringAuthStore((s) => s.user);
  const loading = useKoringAuthStore((s) => s.loading);
  const initFromDisk = useKoringAuthStore((s) => s.initFromDisk);
  const logout = useKoringAuthStore((s) => s.logout);
  const navigate = useRouteStore((s) => s.navigate);
  const openDialog = useConfirmDialogStore((s) => s.openDialog);

  useEffect(() => {
    if (!user) void initFromDisk();
  }, [user, initFromDisk]);

  const displayName = user?.name || user?.username || "Koring 账户";

  const handleLogout = () => {
    openDialog({
      title: "退出 Koring 账户",
      description: `确定要退出「${displayName}」吗？退出后需要重新登录才能继续同步账户资料。`,
      confirmLabel: "退出登录",
      onConfirm: () => {
        void logout()
          .then(() => toast.success("已退出 Koring 账户"))
          .catch(() => toast.error("退出失败，请稍后重试"));
      },
    });
  };

  if (loading && !user) {
    return (
      <div>
        <PageHeader title="账户" desc="查看与管理你的 Koring Account" />
        <SettingCard className="flex items-center gap-2 py-6 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-[13px]">账户信息加载中…</span>
        </SettingCard>
      </div>
    );
  }

  if (!user) {
    return (
      <div>
        <PageHeader title="账户" desc="查看与管理你的 Koring Account" />

        <SettingCard className="flex flex-col items-center gap-4 py-10 text-center">
          <AccountAvatar size={64} />
          <div className="space-y-1">
            <p className="text-[14px] font-semibold text-foreground">尚未登录 Koring Account</p>
            <p className="text-[12.5px] text-muted-foreground">
              登录后可同步头像、昵称与邮箱，并在这台设备上保持登录状态
            </p>
          </div>
          <Button size="sm" onClick={() => navigate("setting/login")}>
            <LogIn className="h-3.5 w-3.5" />
            登录 Koring Account
          </Button>
        </SettingCard>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="账户" desc="查看与管理你的 Koring Account" />

      <div className="space-y-6">
        <div>
          <SectionTitle>账户资料</SectionTitle>
          <SettingCard>
            <div className="flex items-center gap-4 pb-4">
              <AccountAvatar picture={user.picture} name={displayName} size={56} alt={displayName} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold text-foreground" title={displayName}>
                  {displayName}
                </p>
                <p
                  className="mt-0.5 truncate text-[12px] text-muted-foreground/80"
                  title={user.email}
                >
                  {user.email || "Koring Account"}
                </p>
              </div>
            </div>

            <div className="grid gap-3 border-t border-border/40 pt-4 sm:grid-cols-2">
              <InfoRow icon={<Mail className="h-4 w-4" />} label="邮箱" value={user.email} />
              <InfoRow icon={<AtSign className="h-4 w-4" />} label="用户名" value={user.username} />
              <InfoRow
                icon={<Fingerprint className="h-4 w-4" />}
                label="账户 ID"
                value={user.sub}
              />
            </div>
          </SettingCard>
        </div>

        <div>
          <SectionTitle>账户操作</SectionTitle>
          <SettingCard>
            <SettingRow label="退出登录" desc="退出当前 Koring 账户，本地数据与实例不会受影响">
              <Button size="sm" variant="destructive" onClick={handleLogout}>
                <LogOut className="h-3.5 w-3.5" />
                退出
              </Button>
            </SettingRow>
          </SettingCard>
        </div>
      </div>
    </div>
  );
}
