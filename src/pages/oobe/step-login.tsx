import { useState } from "react";
import { useRouteStore } from "@/stores/routeStore";
import { useKoringAuthStore } from "@/stores/koringAuthStore";
import { OobeLayout } from "./layout";
import { KoringLogin } from "@/components/KoringLogin";
import { SettingCard, SettingRow } from "@/components/setting";
import { Button } from "@heroui/react";
import { ChevronRight, Loader2 } from "lucide-react";

/**
 * 详细配置：是否登录 Koring Account。
 * 先询问（不登录也能继续），选择登录后才渲染扫码/授权组件。
 * 已登录时「继续使用」直接进入快速上手，不会再次弹出二维码。
 */
export function OobeLogin() {
  const navigate = useRouteStore((s) => s.navigate);
  const user = useKoringAuthStore((s) => s.user);
  const [stage, setStage] = useState<"ask" | "login">("ask");
  const [justLoggedIn, setJustLoggedIn] = useState(false);

  const finish = () => navigate("oobe/quickstart");

  if (stage === "ask") {
    const displayName = user?.name || user?.username || "当前账户";
    const options = user
      ? [
          { key: "use", label: `继续使用 ${displayName}`, desc: "直接进入快速上手", onClick: finish },
          { key: "switch", label: "切换账户", desc: "登录其他 Koring Account", onClick: () => setStage("login") },
        ]
      : [
          {
            key: "login",
            label: "登录 Koring Account",
            desc: "使用 Koring Link 联机服务与云端配置同步",
            onClick: () => setStage("login"),
          },
          { key: "skip", label: "暂不登录", desc: "之后也可以在设置中登录", onClick: finish },
        ];

    return (
      <OobeLayout>
        <div className="w-full max-w-md flex flex-col items-center gap-3 px-6">
          <div className="text-center space-y-1 mb-1">
            <h2 className="text-lg font-bold text-foreground">登录 Koring Account</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              登录后可以使用 Koring Link 联机服务还有更多其他功能，不登录也可以照常使用。
            </p>
          </div>

          {options.map((opt, i) => (
            <button
              key={opt.key}
              type="button"
              onClick={opt.onClick}
              className="animate-list-item-in w-full text-left"
              style={{ animationDelay: `${i * 55}ms` }}
            >
              <SettingCard className="w-full">
                <SettingRow label={opt.label} desc={opt.desc}>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
                </SettingRow>
              </SettingCard>
            </button>
          ))}
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

        <SettingCard className="w-full animate-list-item-in">
          <KoringLogin
            onLoginSuccess={() => {
              setJustLoggedIn(true);
              setTimeout(finish, 800);
            }}
          />
        </SettingCard>

        {justLoggedIn && (
          <p className="animate-list-item-in flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            登录成功，正在进入下一步...
          </p>
        )}
      </div>

      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-10">
        <Button variant="ghost" size="sm" onPress={finish}>
          不登录，继续
        </Button>
      </div>
    </OobeLayout>
  );
}
