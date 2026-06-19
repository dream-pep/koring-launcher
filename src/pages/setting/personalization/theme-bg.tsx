import { useThemeStore, type DarkMode } from "@/stores/themeStore";
import { useBackgroundStore } from "@/stores/backgroundStore";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import clsx from "clsx";

function GlassCard({ children }: { children: React.ReactNode }) {
  return <div className="glass-card px-5 py-4">{children}</div>;
}

function SettingRow({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {desc && <p className="text-[13px] text-muted-foreground mt-0.5">{desc}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/* ======== 深色模式预览卡片 ======== */

function ThemePreviewCard({ mode, selected, onClick }: { mode: DarkMode; selected: boolean; onClick: () => void }) {
  const isDark = mode === "dark";
  const isAuto = mode === "auto";

  const label = isAuto ? "跟随系统" : isDark ? "深色模式" : "浅色模式";

  return (
    <button
      onClick={onClick}
      className={clsx(
        "relative rounded-md p-1 transition-all duration-200",
        "border-2",
        selected
          ? "border-primary ring-2 ring-primary/20"
          : "border-transparent hover:border-muted-foreground/20",
      )}
    >
      <div className="relative w-[140px] h-[96px] rounded overflow-hidden">
        {isAuto ? (
          /* 跟随系统 — 左右分屏 */
          <div className="flex w-full h-full">
            <div className="w-1/2 h-full bg-white flex flex-col">
              <div className="h-[6px] bg-gray-200 flex items-center px-1 gap-[2px]">
                <div className="w-[3px] h-[3px] rounded-full bg-red-400" />
                <div className="w-[3px] h-[3px] rounded-full bg-yellow-400" />
                <div className="w-[3px] h-[3px] rounded-full bg-green-400" />
              </div>
              <div className="flex-1 px-2 py-1">
                <div className="w-full h-[4px] rounded bg-gray-200 mb-1" />
                <div className="w-3/4 h-[3px] rounded bg-gray-100" />
              </div>
            </div>
            <div className="w-1/2 h-full bg-[#1c1c1e] flex flex-col">
              <div className="h-[6px] bg-[#2c2c2e] flex items-center px-1 gap-[2px]">
                <div className="w-[3px] h-[3px] rounded-full bg-red-400" />
                <div className="w-[3px] h-[3px] rounded-full bg-yellow-400" />
                <div className="w-[3px] h-[3px] rounded-full bg-green-400" />
              </div>
              <div className="flex-1 px-2 py-1">
                <div className="w-full h-[4px] rounded bg-[#3a3a3c] mb-1" />
                <div className="w-3/4 h-[3px] rounded bg-[#2c2c2e]" />
              </div>
            </div>
          </div>
        ) : isDark ? (
          /* 深色模式 */
          <div className="w-full h-full bg-[#1c1c1e] flex flex-col">
            <div className="h-[6px] bg-[#2c2c2e] flex items-center px-1 gap-[2px]">
              <div className="w-[3px] h-[3px] rounded-full bg-red-400" />
              <div className="w-[3px] h-[3px] rounded-full bg-yellow-400" />
              <div className="w-[3px] h-[3px] rounded-full bg-green-400" />
            </div>
            <div className="flex-1 px-2 py-1">
              <div className="w-full h-[4px] rounded bg-[#3a3a3c] mb-1" />
              <div className="w-3/4 h-[3px] rounded bg-[#2c2c2e] mb-1" />
              <div className="w-1/2 h-[3px] rounded bg-[#2c2c2e]" />
            </div>
          </div>
        ) : (
          /* 浅色模式 */
          <div className="w-full h-full bg-white flex flex-col">
            <div className="h-[6px] bg-gray-200 flex items-center px-1 gap-[2px]">
              <div className="w-[3px] h-[3px] rounded-full bg-red-400" />
              <div className="w-[3px] h-[3px] rounded-full bg-yellow-400" />
              <div className="w-[3px] h-[3px] rounded-full bg-green-400" />
            </div>
            <div className="flex-1 px-2 py-1">
              <div className="w-full h-[4px] rounded bg-gray-200 mb-1" />
              <div className="w-3/4 h-[3px] rounded bg-gray-100 mb-1" />
              <div className="w-1/2 h-[3px] rounded bg-gray-100" />
            </div>
          </div>
        )}
      </div>
      <p className="text-[11px] text-center mt-1.5 text-muted-foreground">{label}</p>
    </button>
  );
}

/* ======== 页面 ======== */

export function ThemeBgSetting() {
  const { darkMode, setDarkMode, parallax, setParallax } = useThemeStore();
  const { opacity, setOpacity, blur, setBlur, reset } = useBackgroundStore();

  const handlePickImage = async () => {
    // TODO: 打开文件选择器
  };

  const handleReset = async () => {
    await reset();
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-foreground mb-6">主题与背景</h2>

      <div className="space-y-6">
        {/* ===== 深色模式 ===== */}
        <div>
          <h3 className="text-lg font-bold text-foreground mb-3">深色模式</h3>
          <GlassCard>
            <div className="flex items-center justify-center gap-4 py-2">
              <ThemePreviewCard mode="light" selected={darkMode === "light"} onClick={() => setDarkMode("light")} />
              <ThemePreviewCard mode="auto" selected={darkMode === "auto"} onClick={() => setDarkMode("auto")} />
              <ThemePreviewCard mode="dark" selected={darkMode === "dark"} onClick={() => setDarkMode("dark")} />
            </div>
          </GlassCard>
        </div>

        {/* ===== 背景 ===== */}
        <div>
          <h3 className="text-lg font-bold text-foreground mb-3">背景</h3>
          <div className="space-y-3">
            <GlassCard>
              <SettingRow label="背景图片" desc="更换启动器背景图片">
                <Button variant="outline" size="sm" onClick={handlePickImage}>
                  选择图片
                </Button>
              </SettingRow>
            </GlassCard>

            <GlassCard>
              <SettingRow label="背景模糊" desc={`对背景图施加高斯模糊，当前 ${blur}px`}>
                <Slider
                  className="w-[180px]"
                  value={[blur]}
                  min={0}
                  max={20}
                  step={1}
                  onValueChange={(v) => setBlur(Array.isArray(v) ? v[0] : v)}
                />
              </SettingRow>
            </GlassCard>

            <GlassCard>
              <SettingRow label="背景不透明度" desc={`控制背景图的可见程度，当前 ${Math.round(opacity * 100)}%`}>
                <Slider
                  className="w-[180px]"
                  value={[opacity * 100]}
                  min={0}
                  max={100}
                  step={1}
                  onValueChange={(v) => setOpacity((Array.isArray(v) ? v[0] : v) / 100)}
                />
              </SettingRow>
            </GlassCard>

            <GlassCard>
              <SettingRow
                label="背景图片视差"
                desc="背景图片随窗口滚动产生视差位移"
              >
                <Switch checked={parallax} onCheckedChange={setParallax} />
              </SettingRow>
            </GlassCard>

            <GlassCard>
              <SettingRow label="恢复默认" desc="重置所有背景设置为初始状态">
                <Button variant="destructive" size="sm" onClick={handleReset}>
                  恢复默认
                </Button>
              </SettingRow>
            </GlassCard>
          </div>
        </div>
      </div>
    </div>
  );
}
