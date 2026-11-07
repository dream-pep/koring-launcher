import { Button } from "@/components/ui/button";
import { useRouteStore } from "@/stores/routeStore";

/**
 * 未登录 Koring Account 时占据联机页整行的引导。
 * 陶瓦联机属于需要实名/合规审核的网络服务，必须登录后才能创建/加入房间。
 * 这里不用提示条而用大字号引导：未登录是新用户进入联机页看到的第一屏。
 */
export function LoginRequiredBanner() {
  const navigate = useRouteStore((s) => s.navigate);
  const setSettingsSection = useRouteStore((s) => s.setSettingsSection);

  // 跳转设置 → 账户（src/pages/setting/general/account.tsx）
  const openAccountSetting = () => {
    setSettingsSection("account");
    navigate("setting");
  };

  return (
    <div className="setting-page-enter flex w-full flex-col items-center justify-center gap-7 text-center">
      <div className="flex flex-col items-center gap-3">
        <h1 className="text-[34px] font-bold leading-tight tracking-[-0.02em] text-foreground sm:text-[38px]">
          欢迎使用 Koring Link 联机互联服务
        </h1>
        <p className="text-[15px] leading-relaxed text-muted-foreground">
          请在设置登录您的 Koring Account
        </p>
      </div>

      <Button size="lg" className="min-w-[9.5rem]" onClick={openAccountSetting}>
        前往登录
      </Button>
    </div>
  );
}
