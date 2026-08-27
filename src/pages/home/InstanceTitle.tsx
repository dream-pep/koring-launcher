import { useInstanceStore } from "@/stores/instanceStore";
import { useRouteStore } from "@/stores/routeStore";
import { useConfigStore } from "@/stores/configStore";
import clsx from "clsx";

export function InstanceTitle() {
  const currentInstance = useInstanceStore((s) => s.currentInstance);
  const navigate = useRouteStore((s) => s.navigate);
  const showTitle = useConfigStore((s) => s.config.ui?.showInstanceTitle ?? true);

  if (!showTitle) return null;

  return (
    <div
      onClick={() => navigate("gallery")}
      className={clsx(
        "self-start pl-1 pr-1 py-1.5 rounded-lg cursor-pointer",
        "text-5xl font-bold tracking-tight text-white",
        "hover:bg-black/20",
        "transition-colors duration-200",
        "select-none",
      )}
    >
      {currentInstance?.name ?? "选择一个实例"}
    </div>
  );
}
