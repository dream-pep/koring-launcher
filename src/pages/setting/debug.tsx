import { Button } from "@/components/ui/button";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

export function Debug() {
  const openSplash = async () => {
    try {
      const existing = await WebviewWindow.getByLabel("splashscreen");
      if (existing) {
        await existing.show();
        await existing.setFocus();
        return;
      }

      const splash = new WebviewWindow("splashscreen", {
        url: "/splash.html",
        width: 480,
        height: 320,
        decorations: false,
        transparent: true,
        center: true,
        visible: true,
        resizable: false,
        minWidth: 480,
        maxWidth: 480,
        minHeight: 320,
        maxHeight: 320,
      } as any);

      splash.once("tauri://error", (e) => {
        console.error("Splash window error:", e);
      });
    } catch (err) {
      console.error("Failed to open splash:", err);
    }
  };

  const closeSplash = async () => {
    try {
      const splash = await WebviewWindow.getByLabel("splashscreen");
      if (splash) {
        await splash.close();
      }
    } catch (err) {
      console.error("Failed to close splash:", err);
    }
  };

  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold mb-6 text-foreground">Debug</h1>
        <div className="flex gap-3">
          <Button onClick={openSplash}>Open Splash</Button>
          <Button variant="destructive" onClick={closeSplash}>Close Splash</Button>
        </div>
      </div>
    </div>
  );
}
