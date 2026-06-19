import { useA11yStore } from "@/stores/a11yStore";
import { Switch } from "@/components/ui/switch";

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

export function A11ySetting() {
  const { reduceMotion, setReduceMotion, reduceTransparency, setReduceTransparency, highContrast, setHighContrast } = useA11yStore();

  return (
    <div>
      <h2 className="text-xl font-bold text-foreground mb-6">辅助功能</h2>

      <div className="space-y-6">
        {/* ===== 显示 ===== */}
        <div>
          <h3 className="text-lg font-bold text-foreground mb-3">显示</h3>
          <div className="space-y-3">
            <GlassCard>
              <SettingRow label="减少动画" desc="关闭页面切换动画和背景动效">
                <Switch checked={reduceMotion} onCheckedChange={setReduceMotion} />
              </SettingRow>
            </GlassCard>

            <GlassCard>
              <SettingRow label="减少透明度" desc="将磨砂玻璃效果替换为纯色背景，提升可读性">
                <Switch checked={reduceTransparency} onCheckedChange={setReduceTransparency} />
              </SettingRow>
            </GlassCard>

            <GlassCard>
              <SettingRow label="高对比度" desc="增强文字与背景的对比度，改善可读性">
                <Switch checked={highContrast} onCheckedChange={setHighContrast} />
              </SettingRow>
            </GlassCard>
          </div>
        </div>
      </div>
    </div>
  );
}
