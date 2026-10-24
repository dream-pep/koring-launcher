import { useState, type ReactNode } from "react";
import { Button, Avatar } from "@heroui/react";
import {
  Gamepad2,
  LogOut,
  Loader2,
  UserRound,
  Wifi,
  ShieldQuestion,
  AlertCircle,
  Copy,
  Fingerprint,
  Container,
} from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/authStore";
import { useInstanceStore } from "@/stores/instanceStore";
import {
  SettingCard,
  SettingBadge,
  SettingInput,
  PageHeader,
  SectionTitle,
} from "@/components/setting";

// 启动档案信息行（可复制）
function ProfileRow({
  icon,
  label,
  value,
  mono = false,
  copyable = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  mono?: boolean;
  copyable?: boolean;
}) {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("已复制");
    } catch {
      toast.error("复制失败");
    }
  };

  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="w-8 h-8 rounded-lg bg-foreground/[0.05] dark:bg-white/[0.05] flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] text-muted-foreground/70">{label}</p>
        <p className={`text-[13px] text-foreground truncate ${mono ? "font-mono" : ""}`}>{value}</p>
      </div>
      {copyable && (
        <Button size="sm" variant="ghost" className="shrink-0" onPress={handleCopy}>
          <Copy className="w-3.5 h-3.5" />
        </Button>
      )}
    </div>
  );
}

export function GameAccountSetting() {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const error = useAuthStore((s) => s.error);
  const logout = useAuthStore((s) => s.logout);
  const loginOffline = useAuthStore((s) => s.loginOffline);
  const clearError = useAuthStore((s) => s.clearError);

  const currentInstance = useInstanceStore((s) => s.currentInstance);
  const instances = useInstanceStore((s) => s.instances);
  const reference = currentInstance ?? instances[0] ?? null;

  const [username, setUsername] = useState("");

  // 离线账号登录
  const handleOfflineLogin = async () => {
    clearError();
    const name = username.trim();
    if (!name) {
      toast.warning("请输入离线用户名");
      return;
    }
    if (name.length > 16) {
      toast.warning("离线用户名不能超过 16 个字符");
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

  const isPremium = !!user?.accessToken;

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
                      {isPremium ? (
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

        {/* 启动档案 */}
        <div>
          <SectionTitle>启动档案</SectionTitle>
          <div className="space-y-3">
            <SettingCard>
              {user ? (
                <div className="divide-y divide-border/40 dark:divide-white/[0.06]">
                  <ProfileRow
                    icon={<UserRound className="w-4 h-4 text-muted-foreground/70" />}
                    label="游戏内用户名（启动参数 --username）"
                    value={user.username}
                    copyable
                  />
                  <ProfileRow
                    icon={<Fingerprint className="w-4 h-4 text-muted-foreground/70" />}
                    label="玩家 UUID（启动参数 --uuid）"
                    value={user.uuid}
                    mono
                    copyable
                  />
                  <ProfileRow
                    icon={<ShieldQuestion className="w-4 h-4 text-muted-foreground/70" />}
                    label="认证方式"
                    value={isPremium ? "正版登录（携带访问令牌）" : "离线（无访问令牌，服务器需关闭正版验证）"}
                  />
                  <ProfileRow
                    icon={<Container className="w-4 h-4 text-muted-foreground/70" />}
                    label="应用实例"
                    value={
                      reference
                        ? `${reference.name}（Minecraft ${reference.config.runtime.minecraft}）`
                        : "未选择实例（启动前请在主界面选择实例）"
                    }
                  />
                </div>
              ) : (
                <p className="text-[12px] text-muted-foreground py-2">
                  登录账号后，此处会显示将写入启动参数的档案信息（用户名、UUID、认证方式）。
                </p>
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
                <SettingInput
                  label="用户名"
                  desc="离线 UUID 由 MD5(OfflinePlayer:用户名) 推导，同一用户名始终对应同一 UUID"
                  value={username}
                  onChange={setUsername}
                  placeholder="输入离线用户名（不超过 16 字符）"
                  maxLength={16}
                  width="w-full"
                  onEnter={handleOfflineLogin}
                  suffix={
                    <Button
                      size="sm"
                      variant="primary"
                      onPress={handleOfflineLogin}
                      isDisabled={loading || !username.trim()}
                    >
                      {loading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <UserRound className="w-3.5 h-3.5" />
                      )}
                      登录
                    </Button>
                  }
                />
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

            {/* 正版验证方式（对齐 PCL 设置项，当前固定设备代码流） */}
            <SettingCard>
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-foreground/[0.05] dark:bg-white/[0.05]">
                  <ShieldQuestion className="h-4 w-4 text-muted-foreground/70" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">正版验证方式</p>
                    <SettingBadge variant="neutral">设备代码流（固定）</SettingBadge>
                  </div>
                  <p className="mt-0.5 text-[12px] text-muted-foreground/70">
                    微软登录目前固定使用设备代码流；PCL 的「Web 账户管理器」依赖额外组件，暂不提供切换。
                  </p>
                </div>
              </div>
            </SettingCard>
          </div>
        </div>
      </div>
    </div>
  );
}
