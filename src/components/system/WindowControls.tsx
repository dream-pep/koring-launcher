import { useState, useEffect } from "react";
import { BUILD_MODE } from "@/lib/mode";
import { TaskButton } from "@/components/task/TaskButton";
import { useRouteStore } from "@/stores/routeStore";
import { Info } from "lucide-react";
import clsx from "clsx";

interface WindowControlsProps {
  showMinimize?: boolean;
  showMaximize?: boolean;
  showClose?: boolean;
  isSub?: boolean;
  isOobe?: boolean;
}

export function WindowControls({
  showMinimize = true,
  showMaximize = true,
  showClose = true,
  isSub = false,
  isOobe = false,
}: WindowControlsProps) {
  const [isMaximized, setIsMaximized] = useState(false);
  const navigate = useRouteStore((s) => s.navigate);

  useEffect(() => {
    window.electronAPI?.isMaximized().then(setIsMaximized);
    const unlisten = window.electronAPI?.onResized(() => {
      window.electronAPI?.isMaximized().then(setIsMaximized);
    });
    return () => { unlisten?.(); };
  }, []);

  const handleMinimize = () => window.electronAPI?.minimize();
  const handleMaximize = () => window.electronAPI?.maximize();
  const handleClose = () => window.electronAPI?.close();

  const btnClass = "flex items-center justify-center w-[25px] h-[25px] rounded transition-colors cursor-default hover:bg-black/10 dark:hover:bg-white/15 text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white";
  const closeBtnClass = "flex items-center justify-center w-[25px] h-[25px] rounded transition-colors cursor-default hover:bg-red-500 text-black/70 dark:text-white/70 hover:text-white";
  const noDrag: React.CSSProperties = { WebkitAppRegion: "no-drag" };

  const showBadge = BUILD_MODE !== "run";
  const badgeLabel = BUILD_MODE === "dev" ? "DEV" : "BETA";

  const showTask = !isSub && !isOobe;
  const showInfo = isOobe;

  return (
    <div className="flex items-center gap-0.5 pr-2" style={noDrag}>
      {showBadge && (
        <span
          className={clsx(
            "inline-flex items-center justify-center h-[18px] rounded text-[10px] font-bold tracking-wider mr-1",
            BUILD_MODE === "dev"
              ? "w-[30px] bg-amber-500/65 text-amber-700 dark:text-amber-400 border border-amber-500/20"
              : "w-[38px] bg-emerald-500/65 text-emerald-800 dark:text-emerald-400 border border-emerald-500/20",
          )}
        >
          {badgeLabel}
        </span>
      )}

      <div
        className="overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
        style={{
          width: showTask ? 27 : 0,
          opacity: showTask ? 1 : 0,
          marginRight: showTask ? 2 : 0,
        }}
      >
        <TaskButton />
      </div>

      <div
        className="overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
        style={{
          width: showInfo ? 27 : 0,
          opacity: showInfo ? 1 : 0,
          marginRight: showInfo ? 2 : 0,
        }}
      >
        <button
          onClick={() => navigate("oobe/about-info")}
          className={clsx(btnClass, "shrink-0")}
          type="button"
          style={noDrag}
        >
          <Info className="w-3.5 h-3.5" />
        </button>
      </div>

      {showMinimize && (
        <button type="button" onClick={handleMinimize} className={btnClass} style={noDrag}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <line x1="2" y1="6" x2="10" y2="6" />
          </svg>
        </button>
      )}
      {showMaximize && (
        <button type="button" onClick={handleMaximize} className={btnClass} style={noDrag}>
          {isMaximized ? (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2.5" y="0.5" width="7" height="7" rx="1" />
              <rect x="0.5" y="2.5" width="7" height="7" rx="1" fill="var(--background, #fff)" />
              <rect x="0.5" y="2.5" width="7" height="7" rx="1" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="1" y="1" width="10" height="10" rx="1" />
            </svg>
          )}
        </button>
      )}
      {showClose && (
        <button type="button" onClick={handleClose} className={closeBtnClass} style={noDrag}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <line x1="2" y1="2" x2="10" y2="10" />
            <line x1="10" y1="2" x2="2" y2="10" />
          </svg>
        </button>
      )}
    </div>
  );
}
