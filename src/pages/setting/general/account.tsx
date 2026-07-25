import { useEffect } from "react";
import { useKoringAuthStore } from "@/stores/koringAuthStore";
import { useRouteStore } from "@/stores/routeStore";
import { UserCircle, LogOut, Loader2, ChevronRight } from "lucide-react";
import { Button, Avatar } from "@heroui/react";
import { SettingCard, PageHeader, SectionTitle } from "@/components/setting";

export function AccountSetting() {
  const { user, loading, initFromDisk, logout } = useKoringAuthStore();
  const navigate = useRouteStore((s) => s.navigate);

  useEffect(() => {
    initFromDisk();
  }, [initFromDisk]);

  return (
    <div>
      <PageHeader title="Koring 账户" desc="管理 Koring 工作室账户，用于同步数据、皮肤与个人配置" />

      <div className="space-y-6">
        <div>
          <SectionTitle>账户信息</SectionTitle>
          <SettingCard
            className={
              !user && !loading
                ? "cursor-pointer hover:bg-foreground/[0.04] transition-all duration-200"
                : "cursor-default"
            }
          >
            <div
              onClick={() => {
                if (!user && !loading) navigate("setting/login");
              }}
            >
              {loading ? (
                <div className="flex items-center gap-2 py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">加载中...</span>
                </div>
              ) : user ? (
                <div className="flex items-center gap-4">
                  <Avatar size="lg">
                    {user.picture ? (
                      <Avatar.Image src={user.picture} alt="" />
                    ) : (
                      <Avatar.Fallback>
                        <UserCircle className="w-8 h-8 text-foreground/40" />
                      </Avatar.Fallback>
                    )}
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-medium text-foreground truncate">
                      {user.name || user.username}
                    </p>
                    <p className="text-[13px] text-muted-foreground mt-0.5">Koring 账户</p>
                    {user.email && (
                      <p className="text-[11px] text-muted-foreground/60 mt-0.5">{user.email}</p>
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
                    <p className="text-[12px] text-muted-foreground/60 mt-0.5">点击登录 Koring 账户</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-foreground/20 shrink-0" />
                </div>
              )}
            </div>
          </SettingCard>
        </div>

        {user && (
          <div>
            <SectionTitle>账户操作</SectionTitle>
            <SettingCard>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">退出登录</p>
                  <p className="text-[13px] text-muted-foreground mt-0.5">退出当前账户，数据将保留在本地</p>
                </div>
                <Button
                  variant="danger-soft"
                  size="sm"
                  isDisabled={loading}
                  onPress={logout}
                >
                  <LogOut className="w-3.5 h-3.5" />
                  退出
                </Button>
              </div>
            </SettingCard>
          </div>
        )}
      </div>
    </div>
  );
}
