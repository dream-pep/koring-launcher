import { useDevStore } from "@/stores/devStore";
import { Button } from "@/components/ui/button";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

function GlassCard({ children }: { children: React.ReactNode }) {
  return <div className="glass-card px-5 py-4">{children}</div>;
}

function SettingRow({ label, desc, children }: { label: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-[13px] text-muted-foreground mt-0.5">{desc}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

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

export function DeveloperSetting() {
  const { forceDisableContentBlur, setForceDisableContentBlur } = useDevStore();

  return (
    <div>
      <h2 className="text-xl font-bold text-foreground mb-6">开发者选项</h2>

      <div className="space-y-6">
        {/* ===== 启动画面 ===== */}
        <div>
          <h3 className="text-lg font-bold text-foreground mb-3">启动画面</h3>
          <div className="space-y-3">
            <GlassCard>
              <SettingRow
                label="打开启动画面"
                desc="立即创建并显示 Splash Screen 窗口（480×320）"
              >
                <Button size="sm" onClick={openSplash}>
                  打开
                </Button>
              </SettingRow>
            </GlassCard>
            <GlassCard>
              <SettingRow
                label="关闭启动画面"
                desc="立即关闭当前显示的 Splash Screen 窗口"
              >
                <Button variant="destructive" size="sm" onClick={closeSplash}>
                  关闭
                </Button>
              </SettingRow>
            </GlassCard>
          </div>
        </div>

        {/* ===== 显示效果测试 ===== */}
        <div>
          <h3 className="text-lg font-bold text-foreground mb-3">显示效果测试</h3>
          <div className="space-y-3">
            <GlassCard>
              <SettingRow
                label="强制关闭背景「强内容模式」"
                desc="覆盖系统设置，在设置页面也禁用背景模糊遮罩，用于对比测试"
              >
                <Button
                  variant={forceDisableContentBlur ? "default" : "outline"}
                  size="sm"
                  onClick={() => setForceDisableContentBlur(!forceDisableContentBlur)}
                >
                  {forceDisableContentBlur ? "已开启" : "已关闭"}
                </Button>
              </SettingRow>
            </GlassCard>
          </div>
        </div>
      </div>
    </div>
  );
}
