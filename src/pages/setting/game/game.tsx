import { AlertTriangle, ExternalLink } from "lucide-react";
import { Button } from "@heroui/react";
import { useConfigStore } from "@/stores/configStore";
import { useRouteStore } from "@/stores/routeStore";
import {
  PageHeader,
  SectionTitle,
  SettingCard,
  SettingInput,
  SettingNumberField,
  SettingSelect,
} from "@/components/setting";

/** 启动器行为（对齐 PCL「启动后启动器可见性」） */
const afterLaunchOptions = [
  { value: "close", label: "立即关闭启动器", desc: "启动速度快，但崩溃检测与窗口标题修改会失效" },
  { value: "minimize", label: "最小化到任务栏" },
  { value: "keep", label: "保持不变" },
  { value: "hide", label: "隐藏启动器" },
  { value: "hide-exit", label: "隐藏启动器，游戏退出后关闭启动器" },
  { value: "hide-reopen", label: "隐藏启动器，游戏退出后重新显示" },
];

/** 窗口大小（PCL 的 5 档中，我们支持 3 档；其余在「暂不支持」卡片说明） */
const windowSizeOptions = [
  { value: "default", label: "游戏默认大小" },
  { value: "fullscreen", label: "全屏" },
  { value: "custom", label: "自定义尺寸" },
];

/** IP 协议偏好（落点为 JVM 参数） */
const ipStackOptions = [
  { value: "ipv4", label: "IPv4 优先（-Djava.net.preferIPv4Stack=true）" },
  { value: "default", label: "Java 默认" },
  { value: "ipv6", label: "IPv6 优先（-Djava.net.preferIPv6Stack=true）" },
];

export function GameSetting() {
  const adv = useConfigStore((s) => s.config.advanced);
  const java = useConfigStore((s) => s.config.java);
  const setAdvanced = useConfigStore((s) => s.setAdvanced);
  const setJava = useConfigStore((s) => s.setJava);
  const navigate = useRouteStore((s) => s.navigate);

  const afterLaunchDesc = afterLaunchOptions.find((item) => item.value === adv.afterLaunch)?.desc;

  return (
    <div>
      <PageHeader title="游戏" desc="全局默认启动参数：启动器行为、窗口、进服与网络协议" />

      <div className="space-y-6">
        {/* 启动器行为 */}
        <div>
          <SectionTitle>启动器行为</SectionTitle>
          <div className="space-y-3">
            <SettingCard>
              <div className="space-y-2">
                <SettingSelect
                  label="游戏启动后启动器如何处理"
                  desc={afterLaunchDesc}
                  value={adv.afterLaunch}
                  options={afterLaunchOptions}
                  onChange={(v) => setAdvanced({ afterLaunch: v })}
                />
                {adv.afterLaunch === "close" && (
                  <p className="flex items-start gap-1.5 text-[12px] text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    立即关闭后无法捕获本次运行的崩溃信息；排查问题时建议改用「最小化」或「保持不变」。
                  </p>
                )}
              </div>
            </SettingCard>
          </div>
        </div>

        {/* 窗口大小 */}
        <div>
          <SectionTitle>窗口大小</SectionTitle>
          <div className="space-y-3">
            <SettingCard>
              <div className="space-y-4">
                <SettingSelect
                  label="启动时的窗口大小"
                  desc="全屏与自定义尺寸会写入 --fullscreen / --width / --height"
                  value={adv.winMode}
                  options={windowSizeOptions}
                  onChange={(v) => setAdvanced({ winMode: v })}
                />
                {adv.winMode === "custom" && (
                  <div className="flex flex-wrap items-center gap-4">
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
                  desc="启动游戏后自动加入该服务器；地址留空则不自动加入"
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
                  onChange={(v) => setAdvanced({ server: { ip: adv.server?.ip ?? "", port: v } })}
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

        {/* 网络协议 */}
        <div>
          <SectionTitle>网络协议</SectionTitle>
          <div className="space-y-3">
            <SettingCard>
              <SettingSelect
                label="IP 协议偏好"
                desc="通过 JVM 参数控制游戏网络协议栈；联机大厅异常时可以试试 IPv4 优先"
                value={java.preferredIpStack}
                options={ipStackOptions}
                onChange={(v) => setJava({ preferredIpStack: v })}
              />
            </SettingCard>
          </div>
        </div>

        {/* 暂不支持（对齐 PCL 但不做假设置） */}
        <div>
          <SectionTitle>暂不支持的 PCL 设置项</SectionTitle>
          <div className="space-y-3">
            <SettingCard>
              <div className="space-y-3">
                <p className="text-[12px] leading-relaxed text-muted-foreground">
                  以下 PCL 启动项在当前启动链（@xmcl/core）里没有对应能力，因此没有做成开关，避免出现「改了没效果」的假设置：
                </p>
                <ul className="space-y-1.5 text-[12px] text-muted-foreground">
                  <li>· 游戏窗口标题 / 左下角版本信息：需要进程内注入或窗口句柄改写，@xmcl 无此能力；</li>
                  <li>· 默认实例隔离档位：我们采用「实例自包含 + 共享资源目录」模型，隔离在创建实例时决定，可在实例设置里改；</li>
                  <li>· 进程优先级 / 高性能显卡 / 渲染器：需要 Win32 或显卡驱动层能力，尚未接入；</li>
                  <li>· 正版验证方式：账户模块目前固定设备代码流，暂不暴露为设置。</li>
                </ul>
                <Button size="sm" variant="ghost" onPress={() => navigate("gallery")}>
                  <ExternalLink className="h-3.5 w-3.5" />
                  去实例设置里改隔离 / 资源目录
                </Button>
              </div>
            </SettingCard>
          </div>
        </div>
      </div>
    </div>
  );
}
