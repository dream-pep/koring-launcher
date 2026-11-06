import { useRouteStore } from "@/stores/routeStore";
import { OobeLayout } from "./layout";
import { VersionActivationPanel } from "@/components/VersionActivationPanel";

/**
 * 签署测试协议之后：程序版本激活校验（复用共享面板）。
 * 通过后进入快速上手引导，不展示「版本正常」提示。
 */
export function OobeActivation() {
  const navigate = useRouteStore((s) => s.navigate);

  return (
    <OobeLayout>
      <VersionActivationPanel onPassed={() => navigate("oobe/quickstart")} />
    </OobeLayout>
  );
}
