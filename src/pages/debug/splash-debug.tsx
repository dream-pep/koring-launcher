import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Play, Square, RotateCw } from "lucide-react";
import { GlassCard, SettingRow, PageHeader } from "./components";

const openSplash = async () => {
  try {
    await window.electronAPI?.invoke('window:openSplash');
  } catch (err) {
    console.error("Failed to open splash:", err);
  }
};

const closeSplash = async () => {
  try {
    await window.electronAPI?.invoke('window:closeSplash');
  } catch (err) {
    console.error("Failed to close splash:", err);
  }
};

export function SplashDebug() {
  const [splashVisible, setSplashVisible] = useState(false);

  const handleOpen = async () => {
    await openSplash();
    setSplashVisible(true);
  };

  const handleClose = async () => {
    await closeSplash();
    setSplashVisible(false);
  };

  return (
    <div className="max-w-2xl mx-auto p-8">
      <PageHeader title="启动动画调试" desc="测试 Splash Screen 的显示与关闭" />

      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-foreground/40 uppercase tracking-wider mb-3">
            启动画面控制
          </h3>
          <div className="space-y-3">
            <GlassCard>
              <SettingRow
                label="打开启动画面"
                desc="立即创建并显示 Splash Screen 窗口（480×320）"
              >
                <Button
                  size="sm"
                  onClick={handleOpen}
                  disabled={splashVisible}
                >
                  <Play className="w-3.5 h-3.5 mr-1.5" />
                  打开
                </Button>
              </SettingRow>
            </GlassCard>
            <GlassCard>
              <SettingRow
                label="关闭启动画面"
                desc="立即关闭当前显示的 Splash Screen 窗口"
              >
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleClose}
                  disabled={!splashVisible}
                >
                  <Square className="w-3.5 h-3.5 mr-1.5" />
                  关闭
                </Button>
              </SettingRow>
            </GlassCard>
            <GlassCard>
              <SettingRow
                label="模拟启动流程"
                desc="打开 Splash → 等待 4 秒 → 自动关闭，模拟真实启动"
              >
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await handleOpen();
                    setTimeout(async () => {
                      await handleClose();
                    }, 4000);
                  }}
                  disabled={splashVisible}
                >
                  <RotateCw className="w-3.5 h-3.5 mr-1.5" />
                  模拟
                </Button>
              </SettingRow>
            </GlassCard>
          </div>
        </div>
      </div>
    </div>
  );
}
