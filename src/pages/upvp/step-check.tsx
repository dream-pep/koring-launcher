import { useEffect, useState } from "react";
import { useRouteStore } from "@/stores/routeStore";
import { useConfigStore } from "@/stores/configStore";
import { VERSION } from "@/lib/version";
import { BUILD_MODE } from "@/lib/mode";
import { compareVersions } from "@/api/update";
import { UpvpLayout } from "./layout";
import { NextButton } from "./next-button";
import { Loader2, ArrowUpCircle, AlertTriangle } from "lucide-react";

/** 第三步：检查版本（程序版本 vs 配置文件 appVersion） */
export function UpvpCheck() {
  const navigate = useRouteStore((s) => s.navigate);
  const appVersion = useConfigStore((s) => s.config.appVersion);

  const [state, setState] = useState<"loading" | "updated" | "rollback">("loading");

  useEffect(() => {
    let cancelled = false;
    compareVersions(VERSION, appVersion)
      .then((r) => {
        if (cancelled) return;
        // a>b → 已更新；a<b → 版本倒退；相等/无效 → 视为已更新（正常流程）
        setState(r.result === "a<b" ? "rollback" : "updated");
      })
      .catch(() => {
        if (!cancelled) setState("updated");
      });
    return () => {
      cancelled = true;
    };
  }, [appVersion]);

  const isTestBuild = BUILD_MODE === "dev" || BUILD_MODE === "beta";
  const nextRoute = isTestBuild ? "upvp/beta-test" : "upvp/finish";

  return (
    <UpvpLayout>
      <div className="w-full max-w-lg flex flex-col items-center gap-4 px-6">
        {state === "loading" ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <Loader2 className="w-6 h-6 animate-spin text-foreground/40" />
            <span className="text-sm text-muted-foreground">正在检查版本...</span>
          </div>
        ) : state === "updated" ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <ArrowUpCircle className="w-14 h-14 text-emerald-500" />
            <h2 className="text-lg font-bold text-foreground">已更新至「{VERSION}」</h2>
            <div className="text-xs text-muted-foreground space-y-1 font-mono">
              <p>程序版本：{VERSION}</p>
              <p>配置版本：{appVersion || "（无记录）"}</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-center">
            <AlertTriangle className="w-14 h-14 text-amber-500" />
            <h2 className="text-lg font-bold text-foreground">版本倒退警告</h2>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-sm">
              您好像进行了版本倒退操作，这可能会导致配置文件损坏，建议更新至最新版本。
            </p>
            <div className="text-xs text-muted-foreground space-y-1 font-mono">
              <p>程序版本：{VERSION}</p>
              <p>配置版本：{appVersion}</p>
            </div>
          </div>
        )}
      </div>

      {state !== "loading" && <NextButton onClick={() => navigate(nextRoute)} />}
    </UpvpLayout>
  );
}
