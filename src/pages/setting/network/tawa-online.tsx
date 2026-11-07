import { useEffect } from "react";
import { Button } from "@heroui/react";
import {
  AlertCircle,
  Download,
  ExternalLink,
  FolderOpen,
  Loader2,
  RefreshCw,
  RotateCcw,
  Wrench,
  X,
} from "lucide-react";
import { TERRACOTTA_URL } from "@/api/terracotta";
import type { TerracottaConfig } from "@/api/config";
import { SettingBadge, SettingCard, SettingRow, PageHeader, SectionTitle } from "@/components/setting";
import { useConfirmDialogStore } from "@/stores/confirmDialogStore";
import { useConfigStore } from "@/stores/configStore";
import { useKoringAuthStore } from "@/stores/koringAuthStore";
import { useTerracottaStore } from "@/stores/terracottaStore";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";

const SOURCE_LABEL: Record<string, string> = {
  custom: "自定义路径",
  bundled: "启动器内置",
  dev: "开发模式",
  downloaded: "已下载",
  none: "未知",
};

function openUpstream() {
  if (window.electronAPI?.openExternal) {
    void window.electronAPI.openExternal(TERRACOTTA_URL);
    return;
  }
  window.open(TERRACOTTA_URL, "_blank", "noopener,noreferrer");
}

export function TawaOnlineSetting() {
  const tcConfig = useConfigStore((s) => s.config.network.terracotta);
  const setNetwork = useConfigStore((s) => s.setNetwork);
  const koringName = useKoringAuthStore((s) => s.user?.username ?? "");
  const openConfirm = useConfirmDialogStore((s) => s.openDialog);

  const status = useTerracottaStore((s) => s.status);
  const error = useTerracottaStore((s) => s.error);
  const clearError = useTerracottaStore((s) => s.clearError);
  const init = useTerracottaStore((s) => s.init);
  const refresh = useTerracottaStore((s) => s.refresh);
  const install = useTerracottaStore((s) => s.install);
  const pickBinary = useTerracottaStore((s) => s.pickBinary);
  const clearBinary = useTerracottaStore((s) => s.clearBinary);
  const openDir = useTerracottaStore((s) => s.openDir);
  const pending = useTerracottaStore((s) => s.pending);

  const savedBinaryPath = tcConfig?.binaryPath ?? "";

  // 进入设置页时同步一次真实状态（含安装/版本信息）
  useEffect(() => init(), [init]);

  const patchTerracotta = (patch: Partial<TerracottaConfig>) => {
    setNetwork({
      terracotta: {
        publicNodes: tcConfig?.publicNodes ?? [],
        binaryPath: tcConfig?.binaryPath ?? "",
        ...patch,
      },
    });
  };

  const handlePickBinary = async () => {
    const picked = await pickBinary();
    if (picked) toast.success("已选择本地陶瓦联机程序");
  };

  const handleReinstall = () => {
    openConfirm({
      title: "重新安装陶瓦联机",
      description: "将删除现有联机程序并重新下载安装。房间内的玩家会在服务重启后断开，是否继续？",
      confirmLabel: "重新安装",
      countdown: 3,
      onConfirm: () => {
        void install(true);
      },
    });
  };

  const handleClearBinary = () => {
    openConfirm({
      title: "恢复自动定位",
      description: "将清除自定义的陶瓦联机程序路径，恢复为自动下载/定位。",
      confirmLabel: "恢复自动定位",
      countdown: 3,
      onConfirm: () => {
        void clearBinary();
        patchTerracotta({ binaryPath: "" });
      },
    });
  };

  const binary = status.binary;
  const sourceLabel = SOURCE_LABEL[binary.source] ?? binary.source;

  return (
    <div>
      <PageHeader
        title="陶瓦联机"
        desc="配置陶瓦联机（Terracotta）服务的安装与版本。"
      />

      {error ? (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/[0.07] px-4 py-3">
          <AlertCircle className="mt-0.5 w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
          <p className="min-w-0 flex-1 text-[12px] leading-relaxed text-red-600 dark:text-red-400">{error}</p>
          <button
            type="button"
            onClick={clearError}
            aria-label="关闭错误提示"
            className="shrink-0 rounded p-0.5 text-red-500/70 transition-colors hover:text-red-500"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : null}

      <div className="space-y-6">

        {/* ---------- 程序与版本 ---------- */}
        <div>
          <SectionTitle>程序与版本</SectionTitle>
          <div className="space-y-3">
            <SettingCard>
              <div className="space-y-4">
                <SettingRow label="房间内显示名" desc="跟随 Koring 账号，不支持自定义">
                  <span
                    className={cn("text-[13px]", koringName ? "text-foreground" : "text-muted-foreground")}
                    title={koringName || "未登录 Koring Account"}
                  >
                    {koringName || "未登录 Koring Account"}
                  </span>
                </SettingRow>
                <SettingRow label="安装状态" desc="陶瓦联机可执行文件的当前状态">
                  {binary.installed ? (
                    <SettingBadge variant="success">已安装</SettingBadge>
                  ) : (
                    <SettingBadge variant="warning">未安装</SettingBadge>
                  )}
                </SettingRow>
                <SettingRow label="版本" desc="从程序元数据或目录名推断">
                  <span className="font-mono text-[13px] text-foreground">
                    {status.meta?.version || binary.version || "未知"}
                  </span>
                </SettingRow>
                <SettingRow label="安装来源" desc="程序文件的来源">
                  <span className="text-[13px] text-foreground">{sourceLabel}</span>
                </SettingRow>
                <SettingRow label="程序路径" desc="可执行文件的绝对路径">
                  <span
                    className="max-w-[320px] truncate font-mono text-[12px] text-muted-foreground"
                    title={binary.path || "尚未安装"}
                  >
                    {binary.path || "尚未安装"}
                  </span>
                </SettingRow>
                {status.meta?.easytierVersion ? (
                  <SettingRow label="EasyTier 版本" desc="内置网络组件版本">
                    <span className="font-mono text-[13px] text-foreground">{status.meta.easytierVersion}</span>
                  </SettingRow>
                ) : null}
                <SettingRow label="当前端口" desc="联机服务监听的本地端口（仅主进程内部使用）">
                  <span className="font-mono text-[13px] text-foreground">
                    {status.port > 0 ? status.port : "未运行"}
                  </span>
                </SettingRow>
              </div>
            </SettingCard>

            <SettingCard>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onPress={handleReinstall}
                  isDisabled={pending.install}
                >
                  {pending.install ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  重新安装
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onPress={() => void handlePickBinary()}
                  isDisabled={pending["pick-binary"]}
                >
                  {pending["pick-binary"] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wrench className="w-3.5 h-3.5" />}
                  选择本地二进制
                </Button>
                {savedBinaryPath || binary.source === "custom" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onPress={handleClearBinary}
                    isDisabled={pending["clear-binary"]}
                  >
                    {pending["clear-binary"] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                    恢复自动定位
                  </Button>
                ) : null}
                <Button variant="outline" size="sm" onPress={() => void openDir()} isDisabled={pending["open-dir"]}>
                  {pending["open-dir"] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FolderOpen className="w-3.5 h-3.5" />}
                  打开数据目录
                </Button>
                <Button variant="ghost" size="sm" onPress={() => void refresh()} isDisabled={pending.refresh}>
                  {pending.refresh ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  刷新状态
                </Button>
              </div>
              {savedBinaryPath ? (
                <p className="mt-2 break-all font-mono text-[11px] text-muted-foreground">
                  自定义路径：{savedBinaryPath}
                </p>
              ) : null}
            </SettingCard>
          </div>
        </div>

        {/* ---------- 版权 ---------- */}
        <div>
          <SectionTitle>版权</SectionTitle>
          <div className="space-y-3">
            <SettingCard>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">Powered by Terracotta · 陶瓦联机</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                    本启动器集成了上游开源的陶瓦联机（Terracotta）程序，按其 AGPL 例外条款在界面展示该标识与上游链接。陶瓦联机版权归上游作者所有。
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onPress={openUpstream}
                  className="shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  上游项目
                </Button>
              </div>
            </SettingCard>
          </div>
        </div>
      </div>
    </div>
  );
}
