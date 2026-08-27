import { useState } from "react";
import { Button, Avatar, Input } from "@heroui/react";
import { Gamepad2, LogOut, Loader2, UserRound, Wifi, ShieldQuestion, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/authStore";
import {
  SettingCard,
  SettingBadge,
  PageHeader,
  SectionTitle,
  fieldCls,
} from "@/components/setting";

export function GameAccountSetting() {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const error = useAuthStore((s) => s.error);
  const logout = useAuthStore((s) => s.logout);
  const loginOffline = useAuthStore((s) => s.loginOffline);
  const clearError = useAuthStore((s) => s.clearError);

  const [username, setUsername] = useState("");

  // 离线账号登录
  const handleOfflineLogin = async () => {
    clearError();
    const name = username.trim();
    if (!name) {
      toast.warning("请输入离线用户名");
      return;
    }
    await loginOffline(name);
    if (!useAuthStore.getState().error) {
      toast.success(`已登录离线账号：${name}`);
      setUsername("");
    }
  };

  // 退出登录
  const handleLogout = async () => {
    await logout();
    toast.success("已退出游戏账号");
  };

  return (
    <div>
      <PageHeader title="游戏账户&档案" desc="管理 Minecraft 游戏内账户（离线 / 微软）与登录状态" />

      <div className="space-y-6">
        {/* 当前账号 */}
        <div>
          <SectionTitle>当前账号</SectionTitle>
          <div className="space-y-3">
            <SettingCard>
              {user ? (
                <div className="flex items-center gap-4">
                  <Avatar size="lg" className="shrink-0">
                    <Avatar.Fallback>
                      <UserRound className="w-7 h-7 text-foreground/40" />
                    </Avatar.Fallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-base font-medium text-foreground truncate">{user.username}</p>
                      {user.accessToken ? (
                        <SettingBadge variant="info">微软账号</SettingBadge>
                      ) : (
                        <SettingBadge variant="neutral">离线账号</SettingBadge>
                      )}
                    </div>
                    <p className="text-[12px] text-muted-foreground/70 mt-0.5 font-mono truncate">UUID: {user.uuid}</p>
                    <p className="text-[12px] text-muted-foreground/60 mt-0.5">
                      启动游戏时将自动使用此账号
                    </p>
                  </div>
                  <Button size="sm" variant="danger-soft" className="shrink-0" onPress={handleLogout} isDisabled={loading}>
                    <LogOut className="w-3.5 h-3.5" />
                    退出登录
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                  <div className="w-14 h-14 rounded-full bg-foreground/[0.06] flex items-center justify-center shrink-0">
                    <Gamepad2 className="w-8 h-8 text-foreground/30" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">尚未登录游戏账号</p>
                    <p className="text-[12px] text-muted-foreground/60 mt-1">
                      使用下方离线登录即可启动游戏
                    </p>
                  </div>
                </div>
              )}
            </SettingCard>
          </div>
        </div>

        {/* 登录方式 */}
        <div>
          <SectionTitle>登录方式</SectionTitle>
          <div className="space-y-3">
            {/* 离线账号 */}
            <SettingCard>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-foreground/[0.05] dark:bg-white/[0.05] flex items-center justify-center shrink-0">
                    <Wifi className="w-4 h-4 text-muted-foreground/70" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">离线账号</p>
                    <p className="text-[12px] text-muted-foreground/70">无需正版验证，输入用户名即可启动</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="输入离线用户名（不超过 16 字符）"
                    maxLength={16}
                    fullWidth
                    className={fieldCls}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleOfflineLogin();
                    }}
                  />
                  <Button
                    size="sm"
                    variant="primary"
                    className="shrink-0"
                    onPress={handleOfflineLogin}
                    isDisabled={loading}
                  >
                    {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserRound className="w-3.5 h-3.5" />}
                    登录
                  </Button>
                </div>
                {error && (
                  <p className="text-[12px] text-red-500/80 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {error}
                  </p>
                )}
              </div>
            </SettingCard>

            {/* 微软账号（开发中） */}
            <SettingCard>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-foreground/[0.05] dark:bg-white/[0.05] flex items-center justify-center shrink-0">
                    <ShieldQuestion className="w-4 h-4 text-muted-foreground/70" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">微软账号</p>
                      <SettingBadge variant="warning">开发中</SettingBadge>
                    </div>
                    <p className="text-[12px] text-muted-foreground/70">正版验证登录，支持皮肤与存档同步</p>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="shrink-0" isDisabled>
                  登录
                </Button>
              </div>
            </SettingCard>
          </div>
        </div>
      </div>
    </div>
  );
}
