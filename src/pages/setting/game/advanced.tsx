import { useConfigStore } from "@/stores/configStore";
import { Switch, RadioGroup, Radio, Input, TextArea } from "@heroui/react";
import { SettingCard, SettingRow, PageHeader, SectionTitle } from "@/components/setting";

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
      <PageHeader title="高级设置" desc="游戏高级启动参数、调试选项与实验性功能" />

      <div className="space-y-6">
        <div>
          <SectionTitle>启动行为</SectionTitle>
          <div className="space-y-3">
            <SettingCard>
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">启动后启动器行为</p>
                <p className="text-[13px] text-muted-foreground">游戏启动后启动器的处理方式</p>
                <RadioGroup
                  value={adv.afterLaunch}
                  onValueChange={(v) => setAdvanced({ afterLaunch: v })}
                  className="mt-2 space-y-2"
                >
                  {launcherBehavior.map((opt) => (
                    <Radio key={opt.value} value={opt.value}>
                      <Radio.Content>{opt.label}</Radio.Content>
                    </Radio>
                  ))}
                </RadioGroup>
              </div>
            </SettingCard>
          </div>
        </div>

        <div>
          <SectionTitle>窗口设置</SectionTitle>
          <div className="space-y-3">
            <SettingCard>
              <div className="space-y-3">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">窗口大小</p>
                  <RadioGroup
                    value={adv.winMode}
                    onValueChange={(v) => setAdvanced({ winMode: v })}
                    className="space-y-2"
                  >
                    {windowSize.map((opt) => (
                      <Radio key={opt.value} value={opt.value}>
                        <Radio.Content>{opt.label}</Radio.Content>
                      </Radio>
                    ))}
                  </RadioGroup>
                </div>
                {adv.winMode === "custom" && (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] text-muted-foreground">宽</span>
                      <Input
                        type="number"
                        value={String(adv.customWidth)}
                        onChange={(e) => setAdvanced({ customWidth: Number(e.target.value) })}
                        className="w-20"
                      />
                    </div>
                    <span className="text-muted-foreground">×</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] text-muted-foreground">高</span>
                      <Input
                        type="number"
                        value={String(adv.customHeight)}
                        onChange={(e) => setAdvanced({ customHeight: Number(e.target.value) })}
                        className="w-20"
                      />
                    </div>
                  </div>
                )}
              </div>
            </SettingCard>
          </div>
        </div>

        <div>
          <SectionTitle>游戏参数</SectionTitle>
          <div className="space-y-3">
            <SettingCard>
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">额外游戏启动参数</p>
                <p className="text-[13px] text-muted-foreground">附加到游戏启动命令末尾的参数</p>
                <Input
                  value={adv.gameArgs}
                  onChange={(e) => setAdvanced({ gameArgs: e.target.value })}
                  placeholder="可选，例如 --demo"
                  fullWidth
                />
              </div>
            </SettingCard>
          </div>
        </div>

        <div>
          <SectionTitle>启动命令</SectionTitle>
          <div className="space-y-3">
            <SettingCard>
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">启动前执行命令</p>
                <p className="text-[13px] text-muted-foreground">游戏启动前自动执行的命令或程序路径</p>
                <Input
                  value={adv.preLaunchCmd}
                  onChange={(e) => setAdvanced({ preLaunchCmd: e.target.value })}
                  placeholder="可选，例如 D:\scripts\pre-launch.bat"
                  fullWidth
                />
              </div>
            </SettingCard>
          </div>
        </div>

        <div>
          <SectionTitle>调试</SectionTitle>
          <div className="space-y-3">
            <SettingCard>
              <SettingRow label="调试模式" desc="启用后将在控制台输出详细日志，可能影响性能">
                <Switch isSelected={adv.debugMode} onValueChange={(v) => setAdvanced({ debugMode: v })}>
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
