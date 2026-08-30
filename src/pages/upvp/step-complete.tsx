import { useRouteStore } from "@/stores/routeStore";
import { UpvpLayout } from "./layout";
import { NextButton } from "./next-button";
import { CheckCircle2 } from "lucide-react";

/** 第一步：更新已完成 */
export function UpvpComplete() {
  const navigate = useRouteStore((s) => s.navigate);

  return (
    <UpvpLayout>
      <div className="flex flex-col items-center gap-4">
        <CheckCircle2 className="w-16 h-16 text-emerald-500" />
        <h2 className="text-2xl font-bold text-foreground">更新已完成</h2>
        <p className="text-sm text-muted-foreground">Koring Launcher 已成功更新，来了解一下新的改动吧！</p>
      </div>

      <NextButton onClick={() => navigate("upvp/version")} />
    </UpvpLayout>
  );
}
