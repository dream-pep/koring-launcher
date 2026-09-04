import { useRouteStore } from "@/stores/routeStore";
import { BUILD_MODE } from "@/lib/mode";
import { VERSION } from "@/lib/version";
import { OobeLayout } from "./layout";
import { NextButton } from "./next-button";
import { AboutVersion } from "@/components/about-version";

/** 版本卡片之后：关于此版本（展示当前版本更新内容，引用 AboutVersion 组件） */
export function OobeAboutVersion() {
  const navigate = useRouteStore((s) => s.navigate);

  const isTestBuild = BUILD_MODE === "dev" || BUILD_MODE === "beta";
  // 与原本 step-version 的分流一致：测试版需先同意 Beta 测试协议
  const nextRoute = isTestBuild ? "oobe/beta-test" : "oobe/finish";

  return (
    <OobeLayout>
      <div className="w-full max-w-lg flex flex-col items-center px-6">
        <h2 className="text-lg font-bold text-foreground mb-0.5">关于此版本</h2>
        <p className="text-[12px] text-muted-foreground mb-4">当前版本 v{VERSION} 的更新内容</p>

        {/* 内容滚动区：限高避免遮挡底部下一步按钮 */}
        <div className="w-full max-h-[58vh] overflow-y-auto scroll-area pr-1 -mr-1 min-h-[140px]">
          <AboutVersion />
        </div>
      </div>

      <NextButton onClick={() => navigate(nextRoute)} />
    </OobeLayout>
  );
}
