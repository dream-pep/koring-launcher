import { useAuthStore } from "@/stores/authStore";
import { Button } from "@/components/ui/button";
import { UserCircle, LogOut, RefreshCw } from "lucide-react";

function GlassCard({ children }: { children: React.ReactNode }) {
  return <div className="glass-card px-5 py-4">{children}</div>;
}

function SettingRow({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {desc && <p className="text-[13px] text-muted-foreground mt-0.5">{desc}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function AccountSetting() {
  const { user, loading, logout, startMicrosoftLogin } = useAuthStore();

  return (
    <div>
      <h2 className="text-xl font-bold text-foreground mb-1">Koring 账户</h2>
      <p className="text-sm text-muted-foreground mb-6">管理 Koring 工作室账户，用于同步数据、皮肤与个人配置</p>

      <div className="space-y-6">
        {/* ===== 账户信息 ===== */}
        <div>
          <h3 className="text-lg font-bold text-foreground mb-3">账户信息</h3>
          <GlassCard>
            {user ? (
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-foreground/[0.06] flex items-center justify-center shrink-0">
                  <UserCircle className="w-8 h-8 text-foreground/40" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-medium text-foreground truncate">{user.username}</p>
                  <p className="text-[13px] text-muted-foreground mt-0.5">
                    {user.xboxProfile ? "Microsoft 账户" : "本地账户"}
                  </p>
                  {user.uuid && (
                    <p className="text-[11px] text-muted-foreground/60 mt-0.5 font-mono">
                      UUID: {user.uuid}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-foreground/[0.06] flex items-center justify-center shrink-0">
                  <UserCircle className="w-8 h-8 text-foreground/30" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-muted-foreground">尚未登录</p>
                  <p className="text-[12px] text-muted-foreground/60 mt-0.5">登录后可同步数据、皮肤与个人配置</p>
                </div>
              </div>
            )}
          </GlassCard>
        </div>

        {/* ===== 账户操作 ===== */}
        <div>
          <h3 className="text-lg font-bold text-foreground mb-3">账户操作</h3>
          <div className="space-y-3">
            {user ? (
              <>
                <GlassCard>
                  <SettingRow
                    label="同步数据"
                    desc="立即拉取最新的云端配置与数据"
                  >
                    <Button variant="outline" size="sm" disabled={loading}>
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                      同步
                    </Button>
                  </SettingRow>
                </GlassCard>
                <GlassCard>
                  <SettingRow
                    label="退出登录"
                    desc="退出当前账户，数据将保留在本地"
                  >
                    <Button variant="destructive" size="sm" onClick={logout} disabled={loading}>
                      <LogOut className="w-3.5 h-3.5 mr-1.5" />
                      退出
                    </Button>
                  </SettingRow>
                </GlassCard>
              </>
            ) : (
              <GlassCard>
                <SettingRow
                  label="登录 Koring 账户"
                  desc="通过 Microsoft 账户登录以同步数据、皮肤与个人配置"
                >
                  <Button size="sm" onClick={() => startMicrosoftLogin("00000000-0000-0000-0000-000000000000")} disabled={loading}>
                    登录
                  </Button>
                </SettingRow>
              </GlassCard>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
