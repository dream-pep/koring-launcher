import { useRouteStore } from "@/stores/routeStore";
import { UpvpLayout } from "./layout";
import { VersionActivationPanel } from "@/components/VersionActivationPanel";

/**
 * 更新引导中：程序版本激活校验（与 OOBE 同一套逻辑与文案，共享面板）。
 * 走位与 OOBE 一致 —— 测试版在签署 Beta 测试协议之后，正式版在版本检查之后；
 * 通过后直接进入 UPVP 结束页，不展示「版本正常」提示。
 */
export function UpvpActivation() {
  const navigate = useRouteStore((s) => s.navigate);

  return (
    <UpvpLayout>
      <VersionActivationPanel onPassed={() => navigate("upvp/finish")} />
    </UpvpLayout>
  );
}
