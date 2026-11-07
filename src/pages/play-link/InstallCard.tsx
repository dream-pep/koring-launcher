import { Button } from "@heroui/react";
import { AlertCircle, Download, FolderOpen, Loader2, RotateCcw, Wrench } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useConfigStore } from "@/stores/configStore";
import { useTerracottaStore } from "@/stores/terracottaStore";
import { toast } from "@/lib/toast";
import { StateCard } from "./StateCard";

const STAGE_LABEL: Record<string, string> = {
  idle: "准备中",
  download: "正在下载",
  extract: "正在解压",
  verify: "正在校验",
  done: "安装完成",
  error: "安装失败",
};

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

/** 状态①：二进制未安装 */
export function InstallCard() {
  const installState = useTerracottaStore((s) => s.status.install);
  const install = useTerracottaStore((s) => s.install);
  const pendingInstall = useTerracottaStore((s) => s.pending.install);
  const pickBinary = useTerracottaStore((s) => s.pickBinary);
  const pendingPick = useTerracottaStore((s) => s.pending["pick-binary"]);
  const clearBinary = useTerracottaStore((s) => s.clearBinary);
  const pendingClear = useTerracottaStore((s) => s.pending["clear-binary"]);
  const openDir = useTerracottaStore((s) => s.openDir);
  const pendingOpenDir = useTerracottaStore((s) => s.pending["open-dir"]);
  const savedBinaryPath = useConfigStore((s) => s.config.network.terracotta?.binaryPath ?? "");

  const busy = pendingInstall || installState.active;
  const percent = Math.max(0, Math.min(100, Math.round(installState.percent || 0)));
  const showProgress = installState.active || installState.stage !== "idle";

  const handlePick = async () => {
    const picked = await pickBinary();
    if (picked) toast.success("已选择本地陶瓦联机程序");
  };

  return (
    <StateCard
      icon={<Download className="w-5 h-5" />}
      tone="primary"
      title="尚未安装陶瓦联机"
      description="陶瓦联机（Terracotta）让你无需公网 IP 或端口映射，就能和好友一起玩单人存档。首次使用需要下载约 10 MB 的联机程序。"
      actions={
        <>
          <Button variant="primary" onPress={() => void install(false)} isDisabled={busy}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {busy ? "正在安装…" : "下载并安装"}
          </Button>
          <Button variant="outline" onPress={() => void handlePick()} isDisabled={pendingPick}>
            {pendingPick ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />}
            选择本地二进制
          </Button>
          {savedBinaryPath ? (
            <Button
              variant="ghost"
              onPress={() => void clearBinary()}
              isDisabled={pendingClear}
            >
              {pendingClear ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
              恢复自动定位
            </Button>
          ) : null}
          <Button variant="ghost" onPress={() => void openDir()} isDisabled={pendingOpenDir}>
            <FolderOpen className="w-4 h-4" />
            打开数据目录
          </Button>
        </>
      }
    >
      {showProgress ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-muted-foreground">
              {STAGE_LABEL[installState.stage] ?? "正在安装"}
              {installState.total > 0
                ? ` · ${formatBytes(installState.transferred)} / ${formatBytes(installState.total)}`
                : ""}
            </span>
            <span className="font-mono text-foreground">{percent}%</span>
          </div>
          <Progress value={percent} />
          {installState.stage === "error" && installState.message ? (
            <p className="flex items-start gap-1.5 text-[12px] text-red-600 dark:text-red-400">
              <AlertCircle className="mt-0.5 w-3.5 h-3.5 shrink-0" />
              {installState.message}
            </p>
          ) : installState.message ? (
            <p className="text-[12px] text-muted-foreground">{installState.message}</p>
          ) : null}
        </div>
      ) : (
        <p className="text-[12px] text-muted-foreground">
          也可以选择已有的 terracotta 可执行文件，或在设置页配置公共节点。
          {savedBinaryPath ? ` 当前自定义路径：${savedBinaryPath}` : ""}
        </p>
      )}
    </StateCard>
  );
}
