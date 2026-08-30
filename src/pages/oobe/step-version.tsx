import { useRouteStore } from "@/stores/routeStore";
import { OobeLayout } from "./layout";
import { NextButton } from "./next-button";
import { VersionCard } from "@/components/VersionCard";
import { BUILD_MODE } from "@/lib/mode";

export function OobeVersion() {
  const navigate = useRouteStore((s) => s.navigate);

  const isTestBuild = BUILD_MODE === "dev" || BUILD_MODE === "beta";

  // 到达本页前已依次经过 协议(agreement) → 法律(legal) → 欢迎(welcome)，
  // 因此正式版下一步直接结束；测试版需先同意 Beta 测试协议。
  // （不要跳回 agreement——那会形成 agreement → legal → welcome → version → agreement 死循环）
  const nextRoute = isTestBuild ? "oobe/beta-test" : "oobe/finish";

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
