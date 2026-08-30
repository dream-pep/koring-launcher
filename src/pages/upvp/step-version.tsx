import { useRouteStore } from "@/stores/routeStore";
import { BUILD_MODE } from "@/lib/mode";
import { VersionCard } from "@/components/VersionCard";
import { UpvpLayout } from "./layout";
import { NextButton } from "./next-button";

/** 第二步：版本展示（与 OOBE 版本页一致，纯展示版本卡片；检查在下一步） */
export function UpvpVersion() {
  const navigate = useRouteStore((s) => s.navigate);

  const isTestBuild = BUILD_MODE === "dev" || BUILD_MODE === "beta";

  return (
    <UpvpLayout>
      <div className="w-full max-w-lg flex flex-col items-center gap-4 px-6">
        {/* 版本卡片（OOBE 模式：仅展示，无按钮） */}
        <VersionCard oobe className="w-full" />

        {/* 测试版警告（与 OOBE 版本页一致） */}
        {isTestBuild && (
          <p className="text-xs text-muted-foreground text-center max-w-sm leading-relaxed">
            您正在使用测试版本，它并不稳定，不建议用于正式游戏体验，具体内容请以发行版本为准。
          </p>
        )}
      </div>

      <NextButton onClick={() => navigate("upvp/check")} />
    </UpvpLayout>
  );
}
