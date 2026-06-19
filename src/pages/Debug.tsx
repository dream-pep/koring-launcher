import { Button } from "@/components/ui/button";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

interface DebugProps {
  onNavigate: (page: "home") => void;
}

export function Debug({ onNavigate }: DebugProps) {
  const openSplash = async () => {
    const existing = await WebviewWindow.getByLabel("splashscreen");
    if (existing) {
      existing.show();
      return;
    }

    new WebviewWindow("splashscreen", {
      url: "/splash.html",
      width: 480,
      height: 320,
      decorations: false,
      transparent: true,
      center: true,
    });
  };

  const closeSplash = async () => {
    const splash = await WebviewWindow.getByLabel("splashscreen");
    if (splash) {
      splash.close();
    }
  };

  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold mb-6">Debug</h1>
        <div className="flex gap-3">
          <Button onClick={openSplash}>Open Splash</Button>
          <Button variant="destructive" onClick={closeSplash}>Close Splash</Button>
        </div>
        <div className="pt-4">
          <Button variant="ghost" onClick={() => onNavigate("home")}>
            Back to Home
          </Button>
        </div>
      </div>
    </div>
  );
}
