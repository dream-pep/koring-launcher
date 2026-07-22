import { useState, useEffect } from "react";
import { useRouteStore } from "@/stores/routeStore";
import { OobeLayout } from "./layout";
import { NextButton } from "./next-button";
import { VERSION } from "@/lib/version";
import { BUILD_MODE } from "@/lib/mode";

export function OobeVersion() {
  const navigate = useRouteStore((s) => s.navigate);
  const [changelog, setChangelog] = useState("");

  const isTestBuild = BUILD_MODE === "dev" || BUILD_MODE === "beta";
  const badgeLabel = BUILD_MODE === "dev" ? "DEV" : BUILD_MODE === "beta" ? "BETA" : null;

  const nextRoute = isTestBuild ? "oobe/beta-test" : "oobe/login";

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}changelog-${VERSION}.txt`)
      .then((r) => r.text())
      .then(setChangelog)
      .catch(() => setChangelog("暂无更新内容"));
  }, []);

  return (
    <OobeLayout>
      <div className="w-full max-w-lg flex flex-col items-center gap-4 px-6">
        {/* 标题 */}
        <h2 className="text-lg font-bold text-foreground">核对您的版本信息</h2>

        {/* 版本号 + Badge */}
        <div className="flex items-center gap-2.5">
          <span className="text-3xl font-bold tracking-tight text-foreground">
            v{VERSION}
          </span>
          {badgeLabel && (
            <span
              className={[
                "text-[11px] font-bold px-2 py-0.5 rounded-full leading-none",
                BUILD_MODE === "dev"
                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                  : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
              ].join(" ")}
            >
              {badgeLabel}
            </span>
          )}
        </div>

        {/* 测试版警告 */}
        {isTestBuild && (
          <p className="text-xs text-muted-foreground text-center max-w-sm leading-relaxed">
            您正在使用测试版本，它并不稳定，不建议用于正式游戏体验，具体内容请以发行版本为准。
          </p>
        )}

        {/* 更新内容 */}
        <div className="w-full h-[260px] rounded-xl bg-foreground/[0.03] border border-border/50 p-4 overflow-y-auto">
          <pre className="text-xs text-foreground/70 whitespace-pre-wrap font-sans leading-relaxed">
            {changelog}
          </pre>
        </div>
      </div>

      <NextButton onClick={() => navigate(nextRoute)} />
    </OobeLayout>
  );
}
