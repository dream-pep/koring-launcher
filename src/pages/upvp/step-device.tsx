import { useRouteStore } from "@/stores/routeStore";
import { UpvpLayout } from "./layout";
import { DeviceCheckPanel } from "@/components/DeviceCheckPanel";

/**
 * 更新完成页之后：设备状态校验（与 OOBE 同一套逻辑，Account API）。
 * 通过后直接进入版本展示页。
 */
export function UpvpDevice() {
  const navigate = useRouteStore((s) => s.navigate);

  return (
    <UpvpLayout>
      <DeviceCheckPanel onPassed={() => navigate("upvp/version")} />
    </UpvpLayout>
  );
}
