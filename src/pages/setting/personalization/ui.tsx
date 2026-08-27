import { useConfigStore } from "@/stores/configStore";
import {
  SettingCard,
  SettingSwitch,
  PageHeader,
  SectionTitle,
} from "@/components/setting";

export function UiSetting() {
  const ui = useConfigStore((s) => s.config.ui);
  const setUi = useConfigStore((s) => s.setUi);

  return (
    <div>
      <PageHeader title="主界面" desc="自定义启动器主界面的元素显示与交互方式" />

      <div className="space-y-6">
        <div>
          <SectionTitle>界面元素</SectionTitle>
          <div className="space-y-3">
            <SettingCard>
              <SettingSwitch
                label="首页实例标题"
                desc="在首页左下角显示当前实例的大标题（点击可进入实例管理）"
                checked={ui?.showInstanceTitle ?? true}
                onChange={(v) => setUi({ showInstanceTitle: v })}
              />
            </SettingCard>

            <SettingCard>
              <SettingSwitch
                label="任务队列按钮"
                desc="在标题栏右侧显示任务队列入口（安装/下载进度）"
                checked={ui?.showTaskButton ?? true}
                onChange={(v) => setUi({ showTaskButton: v })}
              />
            </SettingCard>
          </div>
        </div>

        <div>
          <SectionTitle>说明</SectionTitle>
          <SettingCard>
            <div className="space-y-1.5">
              <p className="text-[13px] text-muted-foreground">
                背景图片 / 模糊 / 透明度与视差效果请在「主题与背景」中调整。
              </p>
              <p className="text-[13px] text-muted-foreground">
                动画减弱、透明度减弱与高对比度请在「辅助功能」中调整。
              </p>
            </div>
          </SettingCard>
        </div>
      </div>
    </div>
  );
}
