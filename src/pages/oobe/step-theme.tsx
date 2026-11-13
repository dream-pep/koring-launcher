import { useRouteStore } from "@/stores/routeStore";
import { useThemeStore } from "@/stores/themeStore";
import { OobeLayout } from "./layout";
import { NextButton } from "./next-button";
import { ThemePreviewCard } from "@/components/ThemePreviewCard";

const modes = ["light", "auto", "dark"] as const;

/**
 * 详细配置：外观模式选择（浅色 / 跟随系统 / 深色）。
 * 卡片组件与设置页「主题与背景」共用（ThemePreviewCard），选择即实时预览。
 */
export function OobeTheme() {
  const navigate = useRouteStore((s) => s.navigate);
  const darkMode = useThemeStore((s) => s.darkMode);
  const setDarkMode = useThemeStore((s) => s.setDarkMode);

  return (
    <OobeLayout>
      <div className="w-full max-w-lg flex flex-col items-center gap-6 px-6">
        <div className="text-center space-y-1">
          <h2 className="text-lg font-bold text-foreground">选择深色模式</h2>
          <p className="text-xs text-muted-foreground">之后也可以在「设置 - 主题与背景」中随时修改</p>
        </div>

        <div className="flex items-center justify-center gap-3">
          {modes.map((mode, i) => (
            <div key={mode} className="animate-list-item-in" style={{ animationDelay: `${i * 55}ms` }}>
              <ThemePreviewCard
                mode={mode}
                selected={darkMode === mode}
                onClick={() => setDarkMode(mode)}
              />
            </div>
          ))}
        </div>
      </div>

      <NextButton onClick={() => navigate("oobe/login")} />
    </OobeLayout>
  );
}
