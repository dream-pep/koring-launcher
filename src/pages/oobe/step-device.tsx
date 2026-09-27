import { useRouteStore } from "@/stores/routeStore";
import { OobeLayout } from "./layout";
import { DeviceCheckPanel } from "@/components/DeviceCheckPanel";

/**
 * 语言设置之后：设备状态校验（Account API /device/status → 未登记则 /device/report）。
 * 通过后直接进入用户协议页；黑名单 / 请求失败时展示原因并可重试。
 */
export function OobeDevice() {
  const navigate = useRouteStore((s) => s.navigate);

  return (
    <OobeLayout>
      <DeviceCheckPanel onPassed={() => navigate("oobe/agreement")} />
    </OobeLayout>
  );
}
