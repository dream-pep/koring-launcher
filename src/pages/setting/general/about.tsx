import { useState, useEffect } from "react";
import { VersionCard } from "@/components/VersionCard";
import { BUILD_MODE } from "@/lib/mode";
import { BUILD_COMMIT, BUILD_ID } from "@/lib/buildInfo";
import { ExternalLink, GitFork, RotateCcw, ChevronDown } from "lucide-react";
import { Link, Select, ListBox, ListBoxItem } from "@heroui/react";
import { useConfigStore } from "@/stores/configStore";
import { SettingCard, SettingRow, SettingSwitch, PageHeader, SectionTitle } from "@/components/setting";
import { Button } from "@/components/ui/button";
import {
  getUpdateChannels,
  getUpdateState,
  onUpdateStatus,
  setUpdateChannel,
  type UpdateChannelDef,
} from "@/api/update";
import { toast } from "sonner";
import { getDeviceId, type DeviceIdentity } from "@/api/system";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

const modeLabels: Record<string, string> = {
  dev: "开发版",
  beta: "测试版",
  run: "正式版",
};

const GITHUB_URL = "https://github.com/lingke-net/koring-launcher";
const OFFICIAL_URL = "https://koring.space";

/** 兜底通道列表：主进程 update:getChannels 不可用时使用，保证下拉框始终有选项 */
const FALLBACK_CHANNELS: UpdateChannelDef[] = [
  { key: "woker", label: "慢走模式", desc: "仅获取正式版更新（稳定）", allowPrerelease: false },
  { key: "runner", label: "跑步模式", desc: "可获取预览版（测试版）更新", allowPrerelease: true },
];

export function AboutSetting() {
  const [open, setOpen] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const canConfirm = countdown <= 0;

  const adv = useConfigStore((s) => s.config.advanced);
  const setAdvanced = useConfigStore((s) => s.setAdvanced);

  // 设备识别码（组合指纹：主板/硬盘/BIOS → 回退系统安装标识）
  const [device, setDevice] = useState<DeviceIdentity | null>(null);
  useEffect(() => {
    let cancelled = false;
    getDeviceId()
      .then((d) => {
        if (!cancelled) setDevice(d);
      })
      .catch(() => {
        if (!cancelled) setDevice(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 更新通道（下拉框，选项来自主进程通道注册表）
  const [channels, setChannels] = useState<UpdateChannelDef[]>([]);
  const [activeChannel, setActiveChannel] = useState("woker");

  useEffect(() => {
    getUpdateChannels()
      .then((list) => setChannels(list.length ? list : FALLBACK_CHANNELS))
      .catch((e) => {
        console.error("[update] 获取更新通道失败，使用内置列表:", e);
        setChannels(FALLBACK_CHANNELS);
      });
    const unsub = onUpdateStatus((s) => {
      if (s.channel) setActiveChannel(s.channel);
    });
    getUpdateState()
      .then((s) => {
        if (s.channel) setActiveChannel(s.channel);
      })
      .catch(() => {});
    return unsub;
  }, []);

  const handleChannelChange = async (key: unknown) => {
    if (typeof key !== "string" || !key || key === activeChannel) return;
    try {
      await setUpdateChannel(key);
      setActiveChannel(key);
      toast.success("更新通道已切换，下次检查更新生效");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => {
    if (!open) return;
    setCountdown(5);
  }, [open]);

  useEffect(() => {
    if (!open || countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [open, countdown]);

  const openLink = (url: string) => {
    window.electronAPI?.openExternal(url);
  };

  const handleConfirm = () => {
    window.electronAPI?.resetConfig();
  };

  return (
    <div>
      <PageHeader title="关于" desc="查看版本信息、更新状态与项目相关链接" />

      <div className="space-y-6">
        {/* 设置页：整卡可点击跳转更新页，显示「查看更新」 */}
        <VersionCard isSettingPage />

        <div>
          <SectionTitle>项目信息</SectionTitle>
          <div className="space-y-3">
            <SettingCard>
              <SettingRow label="应用名称" desc="Koring Launcher">
                <span className="text-[13px] text-muted-foreground">Lingke Network 提供技术支持</span>
              </SettingRow>
            </SettingCard>
            <SettingCard>
              <SettingRow label="构建模式">
                <span className="text-[13px] text-muted-foreground">{modeLabels[BUILD_MODE] ?? BUILD_MODE}</span>
              </SettingRow>
            </SettingCard>
            <SettingCard>
              <SettingRow label="构建来源" desc="构建所用的 commit 与编译号（CI 构建）">
                <span className="text-[13px] text-muted-foreground font-mono">
                  {BUILD_COMMIT ? `commit ${BUILD_COMMIT}` : "本地构建"}
                  {BUILD_ID !== "local" ? ` · #${BUILD_ID}` : ""}
                </span>
              </SettingRow>
            </SettingCard>
            <SettingCard>
              <SettingRow label="技术栈" desc="Electron + React 19 + TypeScript + @xmcl">
                <span className="text-[13px] text-muted-foreground">Node.js</span>
              </SettingRow>
            </SettingCard>
            <SettingCard>
              <SettingRow label="设备识别码" desc="设备追踪ID">
                <span className="text-[13px] text-muted-foreground font-mono">
                  {device?.deviceId ?? "—"}
                </span>
              </SettingRow>
            </SettingCard>
          </div>
        </div>

        <div>
          <SectionTitle>更新设置</SectionTitle>
          <div className="space-y-3">
            <SettingCard>
              <SettingRow label="更新通道" desc="慢走模式仅获取正式版；跑步模式可获取预览版">
                <Select.Root
                  selectedKey={activeChannel}
                  onSelectionChange={handleChannelChange}
                  aria-label="更新通道"
                  className="w-48"
                >
                  <Select.Trigger className="h-8 rounded-lg border border-border/40 dark:border-white/[0.08] bg-white/60 dark:bg-black/30 px-3 hover:border-primary/30 transition-colors">
                    <Select.Value className="text-[13px] text-foreground">
                      {channels.find((c) => c.key === activeChannel)?.label ?? "慢走模式"}
                    </Select.Value>
                    <Select.Indicator>
                      <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                    </Select.Indicator>
                  </Select.Trigger>
                  <Select.Popover className="z-50 rounded-xl border border-border/50 dark:border-white/[0.08] bg-background shadow-xl p-1.5 w-52">
                    <ListBox className="outline-none">
                      {channels.map((c) => (
                        <ListBoxItem
                          key={c.key}
                          id={c.key}
                          textValue={c.label}
                          className="text-[13px] py-1.5 px-2.5 rounded-lg data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary outline-none cursor-pointer"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span>{c.label}</span>
                            <span className="text-[12px] text-muted-foreground">{c.desc}</span>
                          </div>
                        </ListBoxItem>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select.Root>
              </SettingRow>
            </SettingCard>
          </div>
        </div>

        <div>
          <SectionTitle>调试</SectionTitle>
          <div className="space-y-3">
            <SettingCard>
              <SettingSwitch
                label="调试模式"
                desc="启用后附加 -Dkoring.debugMode=true 并在控制台输出详细日志（dev 运行时会同步输出到终端），可能影响性能"
                checked={adv?.debugMode ?? false}
                onChange={(v) => setAdvanced({ debugMode: v })}
              />
            </SettingCard>
          </div>
        </div>

        <div>
          <SectionTitle>相关链接</SectionTitle>
          <div className="space-y-3">
            <SettingCard>
              <SettingRow label="GitHub 仓库" desc="查看源代码、提交 Issue">
                <Link onPress={() => openLink(GITHUB_URL)}>
                  <GitFork className="w-4 h-4" />
                  打开
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </SettingRow>
            </SettingCard>
            <SettingCard>
              <SettingRow label="官方网站" desc="了解更多功能与文档">
                <Link onPress={() => openLink(OFFICIAL_URL)}>
                  访问
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </SettingRow>
            </SettingCard>
          </div>
        </div>

        <div>
          <SectionTitle>危险操作</SectionTitle>
          <SettingCard>
            <SettingRow label="还原所有设置" desc="删除所有配置文件并重启应用">
              <AlertDialog open={open} onOpenChange={setOpen}>
                <AlertDialogTrigger
                  render={
                    <Button variant="destructive" size="sm">
                      <RotateCcw className="w-4 h-4" />
                      还原
                    </Button>
                  }
                />
                <AlertDialogContent size="sm">
                  <AlertDialogHeader>
                    <AlertDialogTitle>您确定要还原所有配置吗？</AlertDialogTitle>
                    <AlertDialogDescription>
                      您还原后，您的实例将会保留，但是所有个性化配置将全部丢失，并且需要重新进行激活
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      disabled={!canConfirm}
                      onClick={handleConfirm}
                    >
                      {countdown > 0 ? `确认还原 (${countdown}s)` : "确认还原"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </SettingRow>
          </SettingCard>
        </div>
      </div>
    </div>
  );
}
