import { Play, Settings, Package, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouteStore } from "@/stores/routeStore";
import { useInstanceStore } from "@/stores/instanceStore";
import { useConfigStore } from "@/stores/configStore";
import { useLaunchStore } from "@/stores/launchStore";
import clsx from "clsx";

export function StartCard() {
  const navigate = useRouteStore((s) => s.navigate);
  const currentInstance = useInstanceStore((s) => s.currentInstance);
  const gameDir = useConfigStore((s) => s.config.game.gameDir);
  const launching = useLaunchStore((s) => s.launching);
  const running = useLaunchStore((s) => s.running);
  const launch = useLaunchStore((s) => s.launch);
  const clearError = useLaunchStore((s) => s.clearError);

  // 启动游戏：自动携带实例 + 主进程权威配置（Java/内存/GC/窗口等）
  const handleLaunch = async () => {
    clearError();
    if (!currentInstance) {
      toast.warning("请先选择一个游戏实例");
      navigate("gallery");
      return;
    }
    await launch(currentInstance.name, gameDir);
    const error = useLaunchStore.getState().error;
    if (error) {
      toast.error(error);
    }
  };

  return (
    <div
      className={clsx(
        "inline-flex items-center gap-1",
        "rounded-full",
        "bg-background/60 backdrop-blur-xl border border-border/40",
        "shadow-lg shadow-black/5 dark:shadow-black/20",
      )}
    >
      {/* Settings button */}
      <button
        onClick={() => navigate("setting")}
        className="flex items-center justify-center w-9 h-9 ml-0.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-150 cursor-pointer shrink-0 rounded-full"
        aria-label="设置"
      >
        <Settings className="w-4 h-4" />
      </button>

      {/* Launch button */}
      <button
        onClick={handleLaunch}
        disabled={launching}
        className="flex items-center justify-center h-9 rounded-full cursor-pointer shrink-0 active:scale-[0.97] transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-70"
      >
        <span className="flex items-center gap-1.5 px-4 h-7 rounded-full font-medium text-sm text-primary bg-primary/10 hover:bg-primary/20 transition-colors">
          {launching ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Play className="w-3.5 h-3.5 fill-current" />
          )}
          {launching ? "正在启动..." : running ? "游戏中" : "启动游戏"}
        </span>
      </button>

      {/* Instance button */}
      <button
        onClick={() => navigate("gallery")}
        className="flex items-center justify-center w-9 h-9 mr-0.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-150 cursor-pointer shrink-0 rounded-full"
        aria-label="选择实例"
      >
        <Package className="w-4 h-4" />
      </button>
    </div>
  );
}
