import { Play, Settings, Package } from "lucide-react";
import { useRouteStore } from "@/stores/routeStore";
import clsx from "clsx";

interface StartCardProps {
  onSettingsClick?: () => void;
}

export function StartCard({ onSettingsClick }: StartCardProps) {
  const navigate = useRouteStore((s) => s.navigate);

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
        onClick={onSettingsClick ?? (() => navigate("setting"))}
        className="flex items-center justify-center w-9 h-9 ml-0.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-150 cursor-pointer shrink-0 rounded-full"
        aria-label="设置"
      >
        <Settings className="w-4 h-4" />
      </button>

      {/* Launch button */}
      <button className="flex items-center justify-center h-9 rounded-full cursor-pointer shrink-0 active:scale-[0.97] transition-all duration-150">
        <span className="flex items-center gap-1.5 px-4 h-7 rounded-full font-medium text-sm text-primary bg-primary/10 hover:bg-primary/20 transition-colors">
          <Play className="w-3.5 h-3.5 fill-current" />
          启动游戏
        </span>
      </button>

      {/* Instance button */}
      <button
        className="flex items-center justify-center w-9 h-9 mr-0.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-150 cursor-pointer shrink-0 rounded-full"
        aria-label="选择实例"
      >
        <Package className="w-4 h-4" />
      </button>
    </div>
  );
}
