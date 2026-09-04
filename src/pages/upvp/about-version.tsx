import { useRouteStore } from "@/stores/routeStore";
import { VERSION } from "@/lib/version";
import { UpvpLayout } from "./layout";
import { NextButton } from "./next-button";
import { AboutVersion } from "@/components/about-version";

/** 版本卡片之后：关于此版本（展示当前版本更新内容，引用 AboutVersion 组件） */
export function UpvpAboutVersion() {
  const navigate = useRouteStore((s) => s.navigate);

  return (
    <UpvpLayout>
      <div className="w-full max-w-lg flex flex-col items-center px-6">
        <h2 className="text-lg font-bold text-foreground mb-0.5">关于此版本</h2>
        <p className="text-[12px] text-muted-foreground mb-4">当前版本 v{VERSION} 的更新内容</p>

        {/* 内容滚动区：限高避免遮挡底部下一步按钮 */}
        <div className="w-full max-h-[58vh] overflow-y-auto scroll-area pr-1 -mr-1 min-h-[140px]">
          <AboutVersion />
        </div>
      </div>

      <NextButton onClick={() => navigate("upvp/check")} />
    </UpvpLayout>
  );
}
