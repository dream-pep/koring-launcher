import { useState, useEffect, useCallback } from "react";
import { useRouteStore } from "@/stores/routeStore";
import { useKoringAuthStore } from "@/stores/koringAuthStore";
import { OobeLayout } from "./layout";
import { NextButton } from "./next-button";
import { KoringLogin } from "@/components/KoringLogin";

export function OobeLogin() {
  const navigate = useRouteStore((s) => s.navigate);
  const user = useKoringAuthStore((s) => s.user);
  const [showSkip, setShowSkip] = useState(false);
  const [justLoggedIn, setJustLoggedIn] = useState(false);

  // 10秒后显示"我暂时不需要"
  useEffect(() => {
    const t = setTimeout(() => setShowSkip(true), 10000);
    return () => clearTimeout(t);
  }, []);

  const handleSuccess = useCallback(() => {
    setJustLoggedIn(true);
    setTimeout(() => navigate("oobe/agreement"), 1500);
  }, [navigate]);

  return (
    <OobeLayout>
      <div className="w-full max-w-md flex flex-col items-center gap-6 px-6">
        {/* 标题 */}
        <div className="text-center space-y-1">
          <h2 className="text-lg font-bold text-foreground">登录 Koring 账户</h2>
          <p className="text-xs text-muted-foreground">
            扫码登录以同步数据、皮肤与个人配置
          </p>
        </div>

        {/* 登录组件 — 自动显示 QR */}
        <KoringLogin onLoginSuccess={handleSuccess} />

        {/* 已登录提示 */}
        {justLoggedIn && (
          <p className="text-xs text-green-600 dark:text-green-400">
            登录成功，正在跳转...
          </p>
        )}
      </div>

      {/* 下一步按钮 — 需要登录才能点击 */}
      <NextButton onClick={() => navigate("oobe/agreement")} disabled={!user && !justLoggedIn} />

      {/* 跳过按钮 — 10秒后显示 */}
      {showSkip && !user && !justLoggedIn && (
        <div className="absolute bottom-6">
          <button
            onClick={() => navigate("oobe/agreement")}
            className="text-[12px] text-foreground/30 hover:text-foreground/50 transition-colors"
          >
            我暂时不需要
          </button>
        </div>
      )}
    </OobeLayout>
  );
}
