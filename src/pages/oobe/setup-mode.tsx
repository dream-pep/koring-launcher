import { useRouteStore } from "@/stores/routeStore";
import { OobeLayout } from "./layout";
import { useOobeSetupStore, type OobeSetupMode } from "@/stores/oobeSetupStore";
import { SettingCard, SettingRow } from "@/components/setting";
import { ChevronRight } from "lucide-react";

const options: { mode: OobeSetupMode; title: string; desc: string }[] = [
  {
    mode: "quick",
    title: "直接使用",
    desc: "只需完成必要的激活校验",
  },
  {
    mode: "detailed",
    title: "详细配置",
    desc: "额外设置外观与账户",
  },
];

/** 初始设置方式：左右两张 SettingRow 卡片。 */
export function OobeSetupMode() {
  const navigate = useRouteStore((s) => s.navigate);
  const setMode = useOobeSetupStore((s) => s.setMode);

  const choose = (mode: OobeSetupMode) => {
    setMode(mode);
    navigate("oobe/agreement");
  };

  return (
    <OobeLayout>
      <div className="w-full max-w-lg flex flex-col items-center gap-4 px-6">
        <div className="text-center space-y-1 mb-1">
          <h2 className="text-lg font-bold text-foreground">初始设置</h2>
          <p className="text-xs text-muted-foreground">选择设置方式，进入启动器后仍可在设置中修改</p>
        </div>

        <div className="w-full grid grid-cols-2 gap-3">
          {options.map((opt, i) => (
            <button
              key={opt.mode}
              type="button"
              onClick={() => choose(opt.mode)}
              className="animate-list-item-in w-full text-left"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <SettingCard className="w-full h-full">
                <SettingRow label={opt.title} desc={opt.desc}>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
                </SettingRow>
              </SettingCard>
            </button>
          ))}
        </div>
      </div>
    </OobeLayout>
  );
}
