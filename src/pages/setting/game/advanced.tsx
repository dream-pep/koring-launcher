import { RotateCcw, AlertTriangle } from "lucide-react";
import { Button } from "@heroui/react";
import { toast } from "sonner";
import { useConfigStore } from "@/stores/configStore";
import { useConfirmDialogStore } from "@/stores/confirmDialogStore";
import {
  PageHeader,
  SectionTitle,
  SettingCard,
  SettingSwitch,
  SettingInput,
  SettingFilePicker,
} from "@/components/setting";

/** 高级设置的默认值（「重置本页」用） */
const ADVANCED_DEFAULTS = {
  afterLaunch: "close",
  winMode: "default",
  customWidth: 854,
  customHeight: 480,
  gameArgs: "",
  preLaunchCmd: "",
  debugMode: false,
  server: { ip: "", port: 25565 },
};

export function AdvancedSetting() {
  const adv = useConfigStore((s) => s.config.advanced);
  const setAdvanced = useConfigStore((s) => s.setAdvanced);
  const openConfirm = useConfirmDialogStore((s) => s.openDialog);

  const resetAdvanced = () => {
    openConfirm({
      title: "重置高级设置",
      description: "将高级设置恢复为默认值（启动参数、启动前命令、调试模式等）。实例级设置不受影响。",
      confirmLabel: "重置",
      countdown: 3,
      onConfirm: () => {
        setAdvanced(ADVANCED_DEFAULTS);
        toast.success("高级设置已恢复默认");
      },
    });
  };

  return (
    <div>
      <PageHeader title="高级设置" desc="底层启动参数与诊断选项；改动前请确认你了解它的作用" />

      <div className="space-y-6">
        {/* 游戏参数 */}
        <div>
          <SectionTitle>游戏参数</SectionTitle>
          <div className="space-y-3">
            <SettingCard>
              <SettingInput
                label="游戏参数尾部"
                desc="直接拼到游戏启动参数末尾，例如 --demo；支持引号包裹含空格的值"
                value={adv.gameArgs}
                onChange={(v) => setAdvanced({ gameArgs: v })}
                placeholder="可选，例如 --demo"
                mono
                width="w-80"
              />
            </SettingCard>
          </div>
        </div>

        {/* 启动前命令 */}
        <div>
          <SectionTitle>启动前命令</SectionTitle>
          <div className="space-y-3">
            <SettingCard>
              <div className="space-y-3">
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
                <p className="flex items-start gap-1.5 text-[12px] text-muted-foreground">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                  命令会同步执行完成后再启动游戏；耗时命令会拖慢启动。
                </p>
              </div>
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
                  启动游戏时实例详情页会展示本次使用的版本、资源目录与 Java 路径；崩溃后可用实例页「日志」页签分析最近一次崩溃。
                </p>
              </div>
            </SettingCard>
          </div>
        </div>

        {/* 暂不支持（PCL 高级启动选项里我们没有对应能力的项） */}
        <div>
          <SectionTitle>暂不支持的 PCL 高级启动项</SectionTitle>
          <div className="space-y-3">
            <SettingCard>
              <div className="space-y-2">
                <p className="text-[12px] leading-relaxed text-muted-foreground">
                  以下项目依赖 PCL 自研组件或操作系统级能力，当前启动链无法兑现，所以没有做成开关：
                </p>
                <ul className="space-y-1.5 text-[12px] text-muted-foreground">
                  <li>· 渲染器（软渲染 / D3D12 / Vulkan）：需要验证 LWJGL 后端参数，暂不提供；</li>
                  <li>· 等待命令执行完成：当前启动前命令已是同步执行，无需单独开关；</li>
                  <li>· 要求 Java 使用高性能显卡：需要 Win32 显卡首选项能力；</li>
                  <li>· 禁用 Java Launch Wrapper / LegacyFix / LWJGL Unsafe Agent：均为 PCL 自研修复组件，我们没有对应物；</li>
                  <li>· 禁用自动崩溃分析：暂未做「崩溃自动弹分析」，因此无需开关。</li>
                </ul>
              </div>
            </SettingCard>
          </div>
        </div>

        {/* 危险区 */}
        <div>
          <SectionTitle>危险区</SectionTitle>
          <div className="space-y-3">
            <SettingCard>
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">重置高级设置</p>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">
                    恢复本页所有默认值；不影响实例级配置与游戏文件。
                  </p>
                </div>
                <Button size="sm" variant="ghost" className="shrink-0 text-destructive" onPress={resetAdvanced}>
                  <RotateCcw className="h-3.5 w-3.5" />
                  重置
                </Button>
              </div>
            </SettingCard>
          </div>
        </div>
      </div>
    </div>
  );
}
