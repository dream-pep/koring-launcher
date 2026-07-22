import { useEffect } from "react";
import { useKoringAuthStore } from "@/stores/koringAuthStore";
import { useRouteStore } from "@/stores/routeStore";
import { UserCircle, LogOut, Loader2, ChevronRight } from "lucide-react";

function GlassCard({ children }: { children: React.ReactNode }) {
  return <div className="glass-card px-5 py-4">{children}</div>;
}

export function AccountSetting() {
  const { user, loading, initFromDisk, logout } = useKoringAuthStore();
  const navigate = useRouteStore((s) => s.navigate);

  useEffect(() => {
    initFromDisk();
  }, [initFromDisk]);

  return (
    <div>
      <h2 className="text-xl font-bold text-foreground mb-1">Koring 账户</h2>
      <p className="text-sm text-muted-foreground mb-6">管理 Koring 工作室账户，用于同步数据、皮肤与个人配置</p>

      <div className="space-y-6">
        {/* 账户信息 */}
        <div>
          <h3 className="text-lg font-bold text-foreground mb-3">账户信息</h3>
          <button
            onClick={() => {
              if (!user && !loading) navigate("setting/login");
            }}
            className={[
              "glass-card px-5 py-4 w-full text-left transition-all duration-200",
              !user && !loading ? "cursor-pointer hover:bg-foreground/[0.04]" : "cursor-default",
            ].join(" ")}
          >
            {loading ? (
              <div className="flex items-center gap-2 py-2">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">加载中...</span>
              </div>
            ) : user ? (
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-foreground/[0.06] flex items-center justify-center shrink-0 overflow-hidden">
                  {user.picture ? (
                    <img src={user.picture} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <UserCircle className="w-8 h-8 text-foreground/40" />
                  )}
                </div>
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
          </button>
        </div>

        {/* 退出登录 */}
        {user && (
          <div>
            <h3 className="text-lg font-bold text-foreground mb-3">账户操作</h3>
            <GlassCard>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">退出登录</p>
                  <p className="text-[13px] text-muted-foreground mt-0.5">退出当前账户，数据将保留在本地</p>
                </div>
                <button
                  onClick={logout}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-medium bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-40"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  退出
                </button>
              </div>
            </GlassCard>
          </div>
        )}
      </div>
    </div>
  );
}
