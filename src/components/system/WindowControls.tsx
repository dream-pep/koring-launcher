import { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

interface WindowControlsProps {
  showMinimize?: boolean;
  showMaximize?: boolean;
  showClose?: boolean;
}

export function WindowControls({
  showMinimize = true,
  showMaximize = true,
  showClose = true,
}: WindowControlsProps) {
  const [isMaximized, setIsMaximized] = useState(false);
  const appWindow = getCurrentWindow();

  useEffect(() => {
    appWindow.isMaximized().then(setIsMaximized);
    const unlisten = appWindow.onResized(() => {
      appWindow.isMaximized().then(setIsMaximized);
    });
    return () => { unlisten.then(fn => fn()); };
  }, [appWindow]);

  const handleMinimize = () => appWindow.minimize();
  const handleMaximize = () => appWindow.toggleMaximize();
  const handleClose = () => appWindow.close();

  const btnClass = "flex items-center justify-center w-[25px] h-[25px] rounded transition-colors cursor-default hover:bg-black/10 dark:hover:bg-white/15 text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white";
  const closeBtnClass = "flex items-center justify-center w-[25px] h-[25px] rounded transition-colors cursor-default hover:bg-red-500 text-black/70 dark:text-white/70 hover:text-white";

  return (
    <div className="flex items-center gap-0.5 pr-2" data-no-drag>
      {showMinimize && (
        <div onClick={handleMinimize} className={btnClass}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <line x1="2" y1="6" x2="10" y2="6" />
          </svg>
        </div>
      )}
      {showMaximize && (
        <div onClick={handleMaximize} className={btnClass}>
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
        </div>
      )}
      {showClose && (
        <div onClick={handleClose} className={closeBtnClass}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <line x1="2" y1="2" x2="10" y2="10" />
            <line x1="10" y1="2" x2="2" y2="10" />
          </svg>
        </div>
      )}
    </div>
  );
}
