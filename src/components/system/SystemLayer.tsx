import { TitleBar } from "./TitleBar";

interface SystemLayerProps {
  showMinimize?: boolean;
  showMaximize?: boolean;
  showClose?: boolean;
}

export function SystemLayer({
  showMinimize = true,
  showMaximize = true,
  showClose = true,
}: SystemLayerProps) {
  return (
    <div
      className="fixed inset-0 z-[100] pointer-events-none"
    >
      <TitleBar
        showMinimize={showMinimize}
        showMaximize={showMaximize}
        showClose={showClose}
      />
    </div>
  );
}
