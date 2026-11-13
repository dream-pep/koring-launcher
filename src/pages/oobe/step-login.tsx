import { useState } from "react";
import { useRouteStore } from "@/stores/routeStore";
import { useKoringAuthStore } from "@/stores/koringAuthStore";
import { OobeLayout } from "./layout";
import { KoringLogin } from "@/components/KoringLogin";
import { UserRound } from "lucide-react";

/**
 * 详细配置：是否登录 Koring Account。
 * 先询问（不登录也能继续），选择登录后才渲染扫码/授权组件。
 * 已登录时「继续使用 xxx」直接进入快速上手。
 */
export function OobeLogin() {
  const navigate = useRouteStore((s) => s.navigate);
  const user = useKoringAuthStore((s) => s.user);
  const [stage, setStage] = useState<"ask" | "login">("ask");
  const [justLoggedIn, setJustLoggedIn] = useState(false);

  const finish = () => navigate("oobe/quickstart");

  if (stage === "ask") {
    return (
      <OobeLayout>
        <div className="w-full max-w-md flex flex-col items-center gap-7 px-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <UserRound className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-lg font-bold text-foreground">登录 Koring Account</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                登录后可以使用 Koring Link 联机服务还有更多其他功能，不登录也可以照常使用。
              </p>
            </div>
          </div>

          <div className="w-full flex flex-col gap-2.5">
            <button
              onClick={() => (user ? finish() : setStage("login"))}
              className="h-11 w-full rounded-xl bg-foreground text-background text-sm font-semibold hover:opacity-90 active:scale-[0.99] transition-[opacity,scale] cursor-pointer"
            >
              {user ? `继续使用 ${user.name || user.username || "当前账户"}` : "登录 Koring Account"}
            </button>
            <button
              onClick={finish}
              className="h-11 w-full rounded-xl bg-foreground/[0.06] hover:bg-foreground/[0.12] text-sm font-medium text-foreground/70 hover:text-foreground transition-colors cursor-pointer"
            >
              不登录，继续
            </button>
          </div>
        </div>
      </OobeLayout>
    );
  }

  return (
    <OobeLayout>
      <div className="w-full max-w-md flex flex-col items-center gap-5 px-6">
        <div className="text-center space-y-1">
          <h2 className="text-lg font-bold text-foreground">登录 Koring Account</h2>
          <p className="text-xs text-muted-foreground">
            已自动打开浏览器授权页，也可以扫码登录以同步数据、皮肤与个人配置
          </p>
        </div>

        <KoringLogin
          onLoginSuccess={() => {
            setJustLoggedIn(true);
            setTimeout(finish, 800);
          }}
        />

        {justLoggedIn && (
          <p className="text-xs text-green-600 dark:text-green-400">登录成功，正在进入下一步...</p>
        )}
      </div>

      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-10">
        <button
          onClick={finish}
          className="text-[12px] text-foreground/40 hover:text-foreground/70 transition-colors cursor-pointer"
        >
          不登录，继续
        </button>
      </div>
    </OobeLayout>
  );
}
