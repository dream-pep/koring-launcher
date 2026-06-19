import { Button } from "@/components/ui/button";
import { useRouteStore } from "@/stores/routeStore";

export function Setting() {
  const navigate = useRouteStore((s) => s.navigate);

  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4 text-foreground">设置</h1>
        <p className="text-muted-foreground mb-6">启动器设置与配置</p>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={() => navigate("debug")}>调试</Button>
        </div>
      </div>
    </div>
  );
}
