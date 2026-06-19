import { getCurrentWindow } from "@tauri-apps/api/window";
import { WindowControls } from "./WindowControls";

interface TitleBarProps {
  showMinimize?: boolean;
  showMaximize?: boolean;
  showClose?: boolean;
}

export function TitleBar({
  showMinimize = true,
  showMaximize = true,
  showClose = true,
}: TitleBarProps) {
  const appWindow = getCurrentWindow();

  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("[data-no-drag]")) return;
    appWindow.startDragging();
  };

  return (
    <div
      className="titlebar fixed top-0 left-0 right-0 h-[40px] flex items-center justify-between z-[100] pointer-events-auto"
      onMouseDown={handleMouseDown}
      style={{
        background: "rgba(255, 255, 255, 0.1)",
        backdropFilter: "blur(12px) saturate(180%)",
        WebkitBackdropFilter: "blur(12px) saturate(180%)",
        borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
        userSelect: "none",
      }}
    >
      <div className="flex-1" />
      <WindowControls
        showMinimize={showMinimize}
        showMaximize={showMaximize}
        showClose={showClose}
      />
    </div>
  );
}
