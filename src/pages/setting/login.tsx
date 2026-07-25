import { useCallback } from "react";
import { useRouteStore } from "@/stores/routeStore";
import { KoringLogin } from "@/components/KoringLogin";

export function SettingLogin() {
  const goBack = useRouteStore((s) => s.goBack);

  const handleSuccess = useCallback(() => {
    setTimeout(() => goBack(), 1500);
  }, [goBack]);

  return (
    <div className="h-full flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-sm flex flex-col items-center gap-6">
        <div className="text-center space-y-1">
          <h2 className="text-lg font-bold text-foreground">扫码登录</h2>
          <p className="text-xs text-muted-foreground">使用任意二维码扫描器扫描下方二维码</p>
        </div>
        <KoringLogin onLoginSuccess={handleSuccess} />
      </div>
    </div>
  );
}
