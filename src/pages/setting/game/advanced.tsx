import { useConfigStore } from "@/stores/configStore";
import {
  SettingCard,
  SettingSelect,
  SettingNumberField,
  SettingSwitch,
  SettingInput,
  SettingFilePicker,
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
              <div className="space-y-3">
                <SettingInput
                  label="自动加入服务器"
                  desc="启动游戏后自动加入该服务器；IP 留空则不自动加入"
                  value={adv.server?.ip ?? ""}
                  onChange={(v) => setAdvanced({ server: { ip: v, port: adv.server?.port ?? 25565 } })}
                  placeholder="例如 mc.example.com"
                  mono
                  width="w-72"
                />
                <SettingNumberField
                  label="服务器端口"
                  desc="默认 25565"
                  value={adv.server?.port ?? 25565}
                  min={1}
                  max={65535}
                  onChange={(v) =>
                    setAdvanced({ server: { ip: adv.server?.ip ?? "", port: v } })
                  }
                />
                {adv.server?.ip?.trim() ? (
                  <p className="text-[12px] text-muted-foreground">
                    启动时将以
                    <code className="font-mono text-foreground/80">
                      {` --server ${adv.server.ip.trim()} --port ${adv.server.port ?? 25565}`}
                    </code>
                    进入该服务器
                  </p>
                ) : null}
              </div>
            </SettingCard>
          </div>
        </div>

        {/* 游戏参数 */}
        <div>
          <SectionTitle>游戏参数</SectionTitle>
          <div className="space-y-3">
            <SettingCard>
              <SettingInput
                label="额外游戏启动参数"
                desc="附加到游戏启动命令末尾的参数，例如 --demo；支持引号包裹含空格的值"
                value={adv.gameArgs}
                onChange={(v) => setAdvanced({ gameArgs: v })}
                placeholder="可选，例如 --demo"
                mono
                width="w-80"
              />
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

        {/* 诊断 */}
        <div>
          <SectionTitle>诊断</SectionTitle>
          <div className="space-y-3">
            <SettingCard>
              <div className="space-y-3">
                <SettingSwitch
                  label="调试模式"
                  desc="开启后写入完整日志（userData/koring.log，5MB 轮转），并给游戏进程附加 -Dkoring.debugMode=true"
                  checked={adv.debugMode}
                  onChange={(v) => setAdvanced({ debugMode: v })}
                />
                <p className="text-[12px] leading-relaxed text-muted-foreground">
                  启动游戏时会在实例详情页展示本次使用的版本、资源目录与 Java 路径，便于排查启动失败问题。
                </p>
              </div>
            </SettingCard>
          </div>
        </div>

      </div>
    </div>
  );
}
