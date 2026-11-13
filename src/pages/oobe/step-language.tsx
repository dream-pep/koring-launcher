import { useState } from "react";
import { useRouteStore } from "@/stores/routeStore";
import { OobeLayout } from "./layout";
import { NextButton } from "./next-button";
import { SettingCard, SettingRow } from "@/components/setting";
import { Check } from "lucide-react";

const languages = [
  { key: "zh-CN", label: "简体中文", available: true },
  { key: "zh-TW", label: "繁体中文", available: false },
  { key: "en", label: "English", available: false },
  { key: "ja", label: "日本語", available: false },
  { key: "ko", label: "한국어", available: false },
  { key: "lzh", label: "文言文（中国）", available: false },
];

/** 语言选择：每个语言一项 SettingRow 卡片。 */
export function OobeLanguage() {
  const navigate = useRouteStore((s) => s.navigate);
  const [selected, setSelected] = useState("zh-CN");

  return (
    <OobeLayout>
      <div className="w-full max-w-sm flex flex-col items-center gap-3 px-6">
        <div className="text-center space-y-1 mb-1">
          <h2 className="text-lg font-bold text-foreground">选择语言</h2>
          <p className="text-xs text-muted-foreground">启动器界面将以该语言显示</p>
        </div>

        {languages.map((lang, i) => {
          const active = lang.available && selected === lang.key;
          return (
            <button
              key={lang.key}
              type="button"
              disabled={!lang.available}
              onClick={() => setSelected(lang.key)}
              className="animate-list-item-in w-full text-left disabled:cursor-not-allowed"
              style={{ animationDelay: `${i * 35}ms` }}
            >
              <SettingCard className="w-full">
                <SettingRow
                  label={lang.label}
                  desc={!lang.available ? "即将推出" : undefined}
                >
                  {active ? (
                    <Check className="w-4 h-4 text-primary" />
                  ) : (
                    <span className="w-4 h-4" />
                  )}
                </SettingRow>
              </SettingCard>
            </button>
          );
        })}
      </div>

      {/* 语言 → 选择配置方式（直接使用 / 详细配置） */}
      <NextButton onClick={() => navigate("oobe/setup-mode")} />
    </OobeLayout>
  );
}
