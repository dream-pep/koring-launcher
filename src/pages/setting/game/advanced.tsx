import { Input } from "@heroui/react";
import { useConfigStore } from "@/stores/configStore";
import {
  SettingCard,
  SettingSelect,
  SettingNumberField,
  SettingFilePicker,
  fieldCls,
  PageHeader,
  SectionTitle,
} from "@/components/setting";
const launcherBehavior = [
  { value: "close", label: "关闭启动器" },
  { value: "minimize", label: "最小化到任务栏" },
  { value: "keep", label: "保持不变" },
];

const windowSize = [
  { value: "default", label: "默认窗口大小" },
  { value: "fullscreen", label: "全屏启动" },
  { value: "custom", label: "自定义尺寸" },
];

export function AdvancedSetting() {
  const adv = useConfigStore((s) => s.config.advanced);
  const setAdvanced = useConfigStore((s) => s.setAdvanced);

  return (
    <div>
      <PageHeader title="高级设置" desc="游戏高级启动参数与实验性功能" />

      <div className="space-y-6">
        {/* 启动行为 */}
        <div>
          <SectionTitle>启动行为</SectionTitle>
          <div className="space-y-3">
            <SettingCard>
              <SettingSelect
                label="启动后启动器行为"
                desc="游戏窗口就绪后启动器的处理方式"
                value={adv.afterLaunch}
                options={launcherBehavior}
                onChange={(v) => setAdvanced({ afterLaunch: v })}
              />
            </SettingCard>
          </div>
        </div>

        {/* 窗口设置 */}
        <div>
          <SectionTitle>窗口设置</SectionTitle>
          <div className="space-y-3">
            <SettingCard>
              <div className="space-y-4">
                <SettingSelect
                  label="窗口大小"
                  value={adv.winMode}
                  options={windowSize}
                  onChange={(v) => setAdvanced({ winMode: v })}
                />
                {adv.winMode === "custom" && (
                  <div className="flex items-center gap-4">
                    <SettingNumberField
                      label="宽"
                      value={adv.customWidth}
                      onChange={(v) => setAdvanced({ customWidth: v })}
                      min={320}
                      max={7680}
                      suffix="px"
                    />
                    <SettingNumberField
                      label="高"
                      value={adv.customHeight}
                      onChange={(v) => setAdvanced({ customHeight: v })}
                      min={240}
                      max={4320}
                      suffix="px"
                    />
                  </div>
                )}
              </div>
            </SettingCard>
          </div>
        </div>

        {/* 快速进入服务器 */}
        <div>
          <SectionTitle>快速进入服务器</SectionTitle>
          <div className="space-y-3">
            <SettingCard>
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">自动加入服务器</p>
                <p className="text-[13px] text-muted-foreground">
                  启动游戏后自动加入该服务器；IP 留空则不自动加入
                </p>
                <div className="flex items-center gap-2">
                  <Input
                    value={adv.server?.ip ?? ""}
                    onChange={(e) =>
                      setAdvanced({ server: { ip: e.target.value, port: adv.server?.port ?? 25565 } })
                    }
                    placeholder="例如 mc.example.com"
                    fullWidth
                    className={fieldCls}
                  />
                  <Input
                    type="number"
                    value={String(adv.server?.port ?? 25565)}
                    onChange={(e) =>
                      setAdvanced({ server: { ip: adv.server?.ip ?? "", port: Number(e.target.value) || 25565 } })
                    }
                    className={`w-24 shrink-0 ${fieldCls}`}
                    aria-label="服务器端口"
                  />
                  <span className="text-[13px] text-muted-foreground shrink-0">端口</span>
                </div>
              </div>
            </SettingCard>
          </div>
        </div>

        {/* 游戏参数 */}
        <div>
          <SectionTitle>游戏参数</SectionTitle>
          <div className="space-y-3">
            <SettingCard>
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">额外游戏启动参数</p>
                <p className="text-[13px] text-muted-foreground">
                  附加到游戏启动命令末尾的参数，例如 --demo；支持引号包裹含空格的值
                </p>
                <Input
                  value={adv.gameArgs}
                  onChange={(e) => setAdvanced({ gameArgs: e.target.value })}
                  placeholder="可选，例如 --demo"
                  fullWidth
                  className={fieldCls}
                />
              </div>
            </SettingCard>
          </div>
        </div>

        {/* 启动命令 */}
        <div>
          <SectionTitle>启动命令</SectionTitle>
          <div className="space-y-3">
            <SettingCard>
              <SettingFilePicker
                label="启动前执行命令"
                desc="游戏启动前自动执行的命令或程序路径（Windows 批处理需以 cmd /c 开头）"
                value={adv.preLaunchCmd}
                onChange={(v) => setAdvanced({ preLaunchCmd: v })}
                placeholder="例如 cmd /c D:\scripts\pre-launch.bat"
                mode="file"
                filters={[
                  { name: "批处理 / 可执行文件", extensions: ["bat", "cmd", "exe"] },
                  { name: "所有文件", extensions: ["*"] },
                ]}
              />
            </SettingCard>
          </div>
        </div>

      </div>
    </div>
  );
}
