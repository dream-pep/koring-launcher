import { Play, Loader2 } from "lucide-react";
import { FadeText } from "@/components/ui/fade-text";
import { toast } from "@/lib/toast";
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
  const launchPrepared = useLaunchStore((s) => s.launchPrepared);
  const clearError = useLaunchStore((s) => s.clearError);

  // 启动游戏：核验 → 补全 → 启动（任务列表可见），窗口就绪后最小化启动器
  const handleLaunch = async () => {
    clearError();
    if (!currentInstance) {
      toast.warning("请先在实例管理中「选择该版本」");
      navigate("gallery");
      return;
    }
    await launchPrepared(currentInstance.name, gameDir, {
      displayName: currentInstance.config.name || currentInstance.name,
      minecraftVersion: currentInstance.config.runtime.minecraft,
    });
    const error = useLaunchStore.getState().error;
    if (error) {
      toast.error(error);
    }
  };

  // 单按钮胶囊：保留原玻璃拟态外观
  return (
    <button
      onClick={handleLaunch}
      disabled={launching || running}
      className={clsx(
        "inline-flex items-center gap-1.5 px-4 h-9 rounded-full",
        // 与顶部标题栏一致的模糊磨砂背景（--titlebar-bg + blur(3px) + --titlebar-border）
        "bg-background/60 backdrop-blur-[5px]",
        "border border-[color:var(--titlebar-border)]",
        "shadow-lg shadow-black/5 dark:shadow-black/20",
        "font-medium text-sm text-primary",
        "cursor-pointer shrink-0 hover:bg-background/40",
        "active:scale-[0.97] hover:scale-[1.02]",
        "transition-[scale,transform,background-color] duration-150 ease-spring",
        "disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:scale-100",
      )}
    >
      {launching ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Play className="w-3.5 h-3.5 fill-current" />
      )}
      <FadeText value={launching ? "正在启动..." : running ? "游戏中" : "启动游戏"} />
    </button>
  );
}
