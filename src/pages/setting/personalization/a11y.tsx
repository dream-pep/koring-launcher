import { useA11yStore } from "@/stores/a11yStore";
import { Switch } from "@heroui/react";
import { SettingCard, SettingRow, PageHeader, SectionTitle } from "@/components/setting";

export function A11ySetting() {
  const { reduceMotion, setReduceMotion, reduceTransparency, setReduceTransparency, highContrast, setHighContrast } = useA11yStore();

  return (
    <div>
      <PageHeader title="辅助功能" desc="调整动画、透明度与对比度以改善使用体验" />

      <div className="space-y-6">
        <div>
          <SectionTitle>显示</SectionTitle>
          <div className="space-y-3">
            <SettingCard>
              <SettingRow label="减少动画" desc="关闭页面切换动画和背景动效">
                <Switch isSelected={reduceMotion} onChange={setReduceMotion}>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch>
              </SettingRow>
            </SettingCard>

            <SettingCard>
              <SettingRow label="减少透明度" desc="将磨砂玻璃效果替换为纯色背景，提升可读性">
                <Switch isSelected={reduceTransparency} onChange={setReduceTransparency}>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch>
              </SettingRow>
            </SettingCard>

            <SettingCard>
              <SettingRow label="高对比度" desc="增强文字与背景的对比度，改善可读性">
                <Switch isSelected={highContrast} onChange={setHighContrast}>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch>
              </SettingRow>
            </SettingCard>
          </div>
        </div>
      </div>
    </div>
  );
}
