import { useEffect, useState } from "react";
import { Button, TextArea } from "@heroui/react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  ExternalLink,
  FolderOpen,
  Loader2,
  RefreshCw,
  RotateCcw,
  Wrench,
  X,
  XCircle,
} from "lucide-react";
import {
  TERRACOTTA_DEFAULT_PUBLIC_NODES,
  TERRACOTTA_URL,
  checkTerracottaNodes,
  type TerracottaNodeProbe,
} from "@/api/terracotta";
import type { TerracottaConfig } from "@/api/config";
import { SettingBadge, SettingCard, SettingRow, PageHeader, SectionTitle, fieldCls } from "@/components/setting";
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

  const publicNodes = tcConfig?.publicNodes ?? [];
  const savedBinaryPath = tcConfig?.binaryPath ?? "";

  // 公共节点：本地编辑（保存时 trim + 过滤空行 + 去重）
  const nodesJoined = publicNodes.join("\n");
  const [nodesDraft, setNodesDraft] = useState(nodesJoined);
  useEffect(() => {
    setNodesDraft(nodesJoined);
  }, [nodesJoined]);

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

  const saveNodes = () => {
    const next = Array.from(
      new Set(
        nodesDraft
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean),
      ),
    );
    const unchanged =
      next.length === publicNodes.length && next.every((value, index) => value === publicNodes[index]);
    if (unchanged) return;
    patchTerracotta({ publicNodes: next });
    toast.success("公共节点已保存");
  };

  // 公用：把预置节点填进编辑框（不直接保存，让用户看得见再决定）
  const applyDefaultNodes = () => {
    setNodesDraft(TERRACOTTA_DEFAULT_PUBLIC_NODES.join("\n"));
    toast.info("已填入预置节点，记得保存");
  };

  // 公共节点连通性检测（主进程只做 DNS / TCP / HTTPS 探测）
  const [nodeProbes, setNodeProbes] = useState<TerracottaNodeProbe[] | null>(null);
  const [probing, setProbing] = useState(false);

  const handleCheckNodes = async () => {
    const list = nodesDraft
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (list.length === 0) {
      toast.info("先填写公共节点再检测");
      return;
    }
    setProbing(true);
    setNodeProbes(null);
    try {
      const result = await checkTerracottaNodes(list);
      setNodeProbes(result);
      const okCount = result.filter((item) => item.ok).length;
      if (okCount > 0) toast.success(`${okCount} / ${result.length} 个节点可用`);
      else toast.warning("所有节点都连不上，请检查地址或网络");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "节点检测失败");
    } finally {
      setProbing(false);
    }
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
        desc="配置陶瓦联机（Terracotta）服务：公共节点、联机程序的安装与版本。"
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
        {/* ---------- 网络 ---------- */}
        <div>
          <SectionTitle>网络</SectionTitle>
          <div className="space-y-3">
            <SettingCard>
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">公共节点</p>
                <p className="text-[13px] text-muted-foreground">
                  每行一个节点，默认已预置可用公共节点；留空则只使用上游内置节点（上游有节点已失效，不建议清空）。
                </p>
                <TextArea
                  aria-label="公共节点"
                  value={nodesDraft}
                  onChange={(event) => setNodesDraft(event.target.value)}
                  onBlur={saveNodes}
                  rows={4}
                  placeholder={"tcp://你的服务器IP:11010\nhttps://your-domain/node"}
                  fullWidth
                  className={cn(fieldCls, "font-mono text-[12px]")}
                />
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] text-muted-foreground">
                    失焦自动保存。支持 `host:port`、`tcp://host:port`、`udp://host:port` 与 `https://…/node`
                    取地址节点；房主与加入方需能连到同一个节点。
                  </p>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onPress={applyDefaultNodes}
                      className="shrink-0"
                    >
                      填入预置
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onPress={handleCheckNodes}
                      isDisabled={probing}
                      className="gap-1.5"
                    >
                      {probing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                      {probing ? "检测中" : "检测连通性"}
                    </Button>
                    <Button size="sm" variant="outline" onPress={saveNodes} className="shrink-0">
                      保存
                    </Button>
                  </div>
                </div>
                {nodeProbes && nodeProbes.length > 0 ? (
                  <ul className="space-y-1.5 border-t border-black/[0.06] pt-3 dark:border-white/[0.06]">
                    {nodeProbes.map((probe) => (
                      <li key={probe.node} className="flex items-start gap-2">
                        {probe.ok ? (
                          <CheckCircle2 className="mt-0.5 w-3.5 h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <XCircle className="mt-0.5 w-3.5 h-3.5 shrink-0 text-red-600 dark:text-red-400" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-mono text-[12px] text-foreground" title={probe.node}>
                            {probe.node}
                          </p>
                          <p
                            className={cn(
                              "text-[11px] leading-relaxed",
                              probe.ok ? "text-muted-foreground" : "text-red-600 dark:text-red-400",
                            )}
                          >
                            {probe.detail}
                            {probe.resolved ? (
                              <span className="ml-1 font-mono text-muted-foreground">（{probe.resolved}）</span>
                            ) : null}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </SettingCard>
          </div>
        </div>

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
