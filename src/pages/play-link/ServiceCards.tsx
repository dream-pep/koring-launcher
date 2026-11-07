import { Button } from "@heroui/react";
import {
  AlertTriangle,
  FolderOpen,
  Loader2,
  Play,
  RefreshCw,
  ServerOff,
  Square,
} from "lucide-react";
import { useConfigStore } from "@/stores/configStore";
import { useTerracottaStore } from "@/stores/terracottaStore";
import { StateCard } from "./StateCard";

/** 状态②：服务未启动 */
export function IdleCard() {
  const status = useTerracottaStore((s) => s.status);
  const start = useTerracottaStore((s) => s.start);
  const pending = useTerracottaStore((s) => s.pending.start);
  const savedName = useConfigStore((s) => s.config.network.terracotta?.playerName ?? "");

  const version = status.meta?.version || status.binary.version;

  // 昵称取设置页配置；留空则由主进程回退到当前账户名
  const handleStart = () => {
    void start(savedName.trim() || undefined);
  };

  return (
    <StateCard
      icon={<Play className="w-5 h-5" />}
      tone="primary"
      title="陶瓦联机服务未运行"
      description="启动后会常驻后台，用于创建或加入房间。使用完毕后可以随时停止，不会影响游戏本身。"
      actions={
        <Button variant="primary" onPress={handleStart} isDisabled={pending}>
          {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {pending ? "正在启动…" : "启动陶瓦联机"}
        </Button>
      }
    >
      <dl className="grid gap-x-6 gap-y-2 text-[12px] sm:grid-cols-2">
        <div className="flex items-center justify-between gap-2">
          <dt className="text-muted-foreground">程序版本</dt>
          <dd className="font-mono text-foreground">{version || "未知"}</dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-muted-foreground">兼容协议</dt>
          <dd className="font-mono text-foreground">{status.meta?.targetTuple || "未知"}</dd>
        </div>
        {status.meta?.easytierVersion ? (
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">EasyTier</dt>
            <dd className="font-mono text-foreground">{status.meta.easytierVersion}</dd>
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-2">
          <dt className="text-muted-foreground">安装来源</dt>
          <dd className="text-foreground">{status.binary.source === "none" ? "未知" : status.binary.source}</dd>
        </div>
      </dl>
    </StateCard>
  );
}

/** 状态③：服务启动中 */
export function StartingCard() {
  return (
    <StateCard
      icon={<Loader2 className="w-5 h-5 animate-spin" />}
      tone="primary"
      title="正在启动联机服务…"
      description="首次启动需要解压运行时组件，通常只需几秒，请稍候。"
    />
  );
}

/** 状态④：服务崩溃 */
export function CrashedCard() {
  const status = useTerracottaStore((s) => s.status);
  const start = useTerracottaStore((s) => s.start);
  const openDir = useTerracottaStore((s) => s.openDir);
  const pending = useTerracottaStore((s) => s.pending.start);
  const pendingOpenDir = useTerracottaStore((s) => s.pending["open-dir"]);

  return (
    <StateCard
      icon={<AlertTriangle className="w-5 h-5" />}
      tone="danger"
      title="联机服务已崩溃"
      description={
        status.snapshot.error ||
        "陶瓦联机进程意外退出。可以尝试重新启动；若反复崩溃，请打开数据目录查看日志并反馈给上游。"
      }
      actions={
        <>
          <Button variant="primary" onPress={() => void start()} isDisabled={pending}>
            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            重新启动
          </Button>
          <Button variant="outline" onPress={() => void openDir()} isDisabled={pendingOpenDir}>
            <FolderOpen className="w-4 h-4" />
            打开数据目录
          </Button>
        </>
      }
    />
  );
}

/** 兜底：running 但状态未知（例如刚切换页面尚未同步） */
export function UnknownCard() {
  const refresh = useTerracottaStore((s) => s.refresh);
  const stop = useTerracottaStore((s) => s.stop);
  const pendingRefresh = useTerracottaStore((s) => s.pending.refresh);
  const pendingStop = useTerracottaStore((s) => s.pending.stop);

  return (
    <StateCard
      icon={<ServerOff className="w-5 h-5" />}
      tone="warning"
      title="正在同步联机状态…"
      description="暂时没有收到陶瓦联机的状态更新，请稍候或手动刷新。"
      actions={
        <>
          <Button variant="outline" onPress={() => void refresh()} isDisabled={pendingRefresh}>
            {pendingRefresh ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            刷新状态
          </Button>
          <Button variant="ghost" onPress={() => void stop()} isDisabled={pendingStop}>
            {pendingStop ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />}
            停止服务
          </Button>
        </>
      }
    />
  );
}
