import { useThemeStore, type DarkMode } from "@/stores/themeStore";
import { useBackgroundStore } from "@/stores/backgroundStore";
import { Switch, Button, Slider } from "@heroui/react";
import { DEFAULT_BG } from "@/lib/mode";
import clsx from "clsx";
import { SettingCard, SettingRow, PageHeader, SectionTitle } from "@/components/setting";

function ThemePreviewCard({ mode, selected, onClick }: { mode: DarkMode; selected: boolean; onClick: () => void }) {
  const isDark = mode === "dark";
  const isAuto = mode === "auto";

  const label = isAuto ? "跟随系统" : isDark ? "深色模式" : "浅色模式";

  return (
    <Button
      variant="ghost"
      onPress={onClick}
      className={clsx(
        "relative rounded-md p-1 transition-all duration-200 h-auto min-w-0",
        "border-2",
        selected
          ? "!border-primary ring-2 ring-primary/20"
          : "!border-transparent hover:!border-muted-foreground/20",
      )}
    >
      <div className="relative w-[140px] h-[96px] rounded overflow-hidden">
        {isAuto ? (
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
    </Button>
  );
}

export function ThemeBgSetting() {
  const { darkMode, setDarkMode, parallax, setParallax } = useThemeStore();
  const { image, opacity, setOpacity, blur, setBlur, setImage, reset } = useBackgroundStore();

  const handlePickImage = async () => {
    const dataUrl = await (window as any).electronAPI?.pickBackgroundImage();
    if (dataUrl) {
      setImage(dataUrl);
    }
  };

  const handleReset = async () => {
    await reset();
  };

  return (
    <div>
      <PageHeader title="主题与背景" desc="切换深色模式、更换背景图片与调整视觉效果" />

      <div className="space-y-6">
        <div>
          <SectionTitle>深色模式</SectionTitle>
          <SettingCard>
            <div className="flex items-center justify-center gap-4 py-2">
              <ThemePreviewCard mode="light" selected={darkMode === "light"} onClick={() => setDarkMode("light")} />
              <ThemePreviewCard mode="auto" selected={darkMode === "auto"} onClick={() => setDarkMode("auto")} />
              <ThemePreviewCard mode="dark" selected={darkMode === "dark"} onClick={() => setDarkMode("dark")} />
            </div>
          </SettingCard>
        </div>

        <div>
          <SectionTitle>背景</SectionTitle>
          <div className="space-y-3">
            <SettingCard>
              <SettingRow label="背景图片" desc="更换启动器背景图片">
                <Button variant="outline" size="sm" onPress={handlePickImage}>
                  选择图片
                </Button>
              </SettingRow>
              {image && image !== DEFAULT_BG && (
                <div className="mt-3 rounded-lg overflow-hidden border border-border/50">
                  <img
                    src={image}
                    alt="背景预览"
                    className="w-full h-[120px] object-cover"
                  />
                </div>
              )}
            </SettingCard>

            <SettingCard>
              <SettingRow label="背景模糊" desc={`对背景图施加高斯模糊，当前 ${blur}px`}>
                <Slider
                  className="w-[180px]"
                  value={blur}
                  minValue={0}
                  maxValue={20}
                  step={1}
                  onChange={(v) => setBlur(typeof v === "number" ? v : v[0])}
                >
                  <Slider.Track>
                    <Slider.Fill />
                    <Slider.Thumb />
                  </Slider.Track>
                </Slider>
              </SettingRow>
            </SettingCard>

            <SettingCard>
              <SettingRow label="背景不透明度" desc={`控制背景图的可见程度，当前 ${Math.round(opacity * 100)}%`}>
                <Slider
                  className="w-[180px]"
                  value={opacity * 100}
                  minValue={0}
                  maxValue={100}
                  step={1}
                  onChange={(v) => setOpacity((typeof v === "number" ? v : v[0]) / 100)}
                >
                  <Slider.Track>
                    <Slider.Fill />
                    <Slider.Thumb />
                  </Slider.Track>
                </Slider>
              </SettingRow>
            </SettingCard>

            <SettingCard>
              <SettingRow label="背景图片视差" desc="背景图片随窗口滚动产生视差位移">
                <Switch isSelected={parallax} onChange={setParallax}>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch>
              </SettingRow>
            </SettingCard>

            <SettingCard>
              <SettingRow label="恢复默认" desc="重置所有背景设置为初始状态">
                <Button variant="danger" size="sm" onPress={handleReset}>
                  恢复默认
                </Button>
              </SettingRow>
            </SettingCard>
          </div>
        </div>
      </div>
    </div>
  );
}
