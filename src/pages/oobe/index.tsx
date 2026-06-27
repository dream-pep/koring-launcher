import { useRouteStore } from "@/stores/routeStore";
import { Rocket, ChevronRight } from "lucide-react";

export function Oobe() {
  const goBack = useRouteStore((s) => s.goBack);

  return (
    <div className="h-full flex flex-col items-center justify-center px-8">
      <div className="flex flex-col items-center text-center max-w-md">
        <div className="p-4 rounded-2xl bg-primary/10 mb-6">
          <Rocket className="w-10 h-10 text-primary" />
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-2">
          欢迎使用 Koring Launcher
        </h1>
        <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
          这是 OOBE（开箱体验）页面。在这里可以引导用户完成初始设置。
        </p>

        <button
          onClick={goBack}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-foreground/[0.06] hover:bg-foreground/[0.1] text-sm font-medium transition-colors"
        >
          返回调试
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
