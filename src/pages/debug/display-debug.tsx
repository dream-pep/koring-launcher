import { useDevStore } from "@/stores/devStore";
import { Button } from "@/components/ui/button";
import { GlassCard, SettingRow, PageHeader } from "./components";

export function DisplayDebug() {
  const { forceDisableContentBlur, setForceDisableContentBlur } = useDevStore();

  return (
    <div className="max-w-2xl mx-auto p-8">
      <PageHeader title="显示效果调试" desc="调试背景遮罩、磨砂效果与视觉表现" />

      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-foreground/40 uppercase tracking-wider mb-3">
            遮罩控制
          </h3>
          <div className="space-y-3">
            <GlassCard>
              <SettingRow
                label="强制关闭背景「强内容模式」"
                desc="覆盖系统设置，在所有页面禁用背景模糊遮罩，用于对比测试"
              >
                <Button
                  variant={forceDisableContentBlur ? "default" : "outline"}
                  size="sm"
                  onClick={() =>
                    setForceDisableContentBlur(!forceDisableContentBlur)
                  }
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
