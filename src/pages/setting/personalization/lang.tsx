import { useConfigStore } from "@/stores/configStore";
import {
  SettingCard,
  SettingSelect,
  SettingBadge,
  PageHeader,
  SectionTitle,
} from "@/components/setting";

const languageOptions = [
  { value: "zh-CN", label: "简体中文" },
  { value: "en-US", label: "English" },
];

export function LangSetting() {
  const language = useConfigStore((s) => s.config.app?.language ?? "zh-CN");
  const setApp = useConfigStore((s) => s.setApp);

  const handleChange = (v: string) => {
    setApp({ language: v });
    document.documentElement.lang = v;
  };

  return (
    <div>
      <PageHeader title="语言" desc="选择启动器界面的显示语言与地区偏好" />

      <div className="space-y-6">
        <div>
          <SectionTitle>显示语言</SectionTitle>
          <div className="space-y-3">
            <SettingCard>
              <SettingSelect
                label="界面语言"
                desc="切换后保存偏好并更新页面 lang 属性"
                value={language}
                options={languageOptions}
                onChange={handleChange}
              />
            </SettingCard>
          </div>
        </div>

        <div>
          <SectionTitle>语言包</SectionTitle>
          <SettingCard>
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground">语言包开发中</p>
                  <SettingBadge variant="warning">开发中</SettingBadge>
                </div>
                <p className="text-[13px] text-muted-foreground mt-0.5">
                  当前界面文案暂为简体中文。所选语言偏好会被保存，后续语言包上线后自动生效。
                </p>
              </div>
            </div>
          </SettingCard>
        </div>
      </div>
    </div>
  );
}
