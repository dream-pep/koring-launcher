import { useRouteStore } from "@/stores/routeStore";
import { OobeLayout } from "./layout";
import { NextButton } from "./next-button";
import { VersionCard } from "@/components/VersionCard";
import { BUILD_MODE } from "@/lib/mode";

export function OobeVersion() {
  const navigate = useRouteStore((s) => s.navigate);

  const isTestBuild = BUILD_MODE === "dev" || BUILD_MODE === "beta";

  // 临时跳过 Koring 账户登录环节：正式版也直接进入用户协议
  const nextRoute = isTestBuild ? "oobe/beta-test" : "oobe/agreement";

  return (
    <OobeLayout>
      <div className="w-full max-w-lg flex flex-col items-center gap-4 px-6">
        {/* 版本卡片（OOBE 模式：无更新逻辑，按钮仅展示样式） */}
        <VersionCard oobe className="w-full" />

        {/* 测试版警告 */}
        {isTestBuild && (
          <p className="text-xs text-muted-foreground text-center max-w-sm leading-relaxed">
            您正在使用测试版本，它并不稳定，不建议用于正式游戏体验，具体内容请以发行版本为准。
          </p>
        )}
      </div>

      <NextButton onClick={() => navigate(nextRoute)} />
    </OobeLayout>
  );
}
