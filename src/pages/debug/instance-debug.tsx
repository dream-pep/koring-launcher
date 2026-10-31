//  __         __     __   __     ______     __  __     ______        __   __     ______     ______
// /\ \       /\ \   /\ "-.\ \   /\  ___\   /\ \/ /    /\  ___\      /\ "-.\ \   /\  ___\   /\__  _\
// \ \ \____  \ \ \  \ \ \-.  \  \ \ \__ \  \ \  _"-.  \ \  __\      \ \ \-.  \  \ \  __\   \/_/\ \/
//  \ \_____\  \ \_\  \ \_\\"\_\  \ \_____\  \ \_\ \_\  \ \_____\     \ \_\\"\_\  \ \_____\    \ \_\
//   \/_____/   \/_/   \/_/ \/_/   \/_____/   \/_/\/_/   \/_____/      \/_/ \/_/   \/_____/     \/_/
//
// 所有权利归Lingke Network (china)所有 | dream_pep拥有其艺术改变权力
// 未经允许的情况下删除此版权头可能会受到民事指控
// 请勿在未经Lingke Network (china)允许的范围内修改代码并分发

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/lib/toast";
import { useConfigStore } from "@/stores/configStore";
import { useInstanceStore } from "@/stores/instanceStore";
import { useLaunchStore } from "@/stores/launchStore";
import {
  diagnoseInstance,
  openPath,
  type InstanceDependencyInfo,
  type InstanceLaunchInfo,
} from "@/api/instance";
import { GlassCard, SettingRow, PageHeader } from "./components";
import { Play, RefreshCw, FolderOpen, Activity, Loader2 } from "lucide-react";

// 分组小标题
function GroupTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold text-foreground/40 uppercase tracking-wider mb-3">
      {children}
    </h3>
  );
}

interface DiagResult {
  healthy: boolean;
  issues: string[];
  launch: InstanceLaunchInfo;
  dependency: InstanceDependencyInfo;
}

export function InstanceDebug() {
  const gameDir = useConfigStore((s) => s.config.game.gameDir);

  const instances = useInstanceStore((s) => s.instances);
  const currentInstance = useInstanceStore((s) => s.currentInstance);
  const loading = useInstanceStore((s) => s.loading);
  const fetchInstances = useInstanceStore((s) => s.fetchInstances);
  const setCurrent = useInstanceStore((s) => s.setCurrent);

  const launching = useLaunchStore((s) => s.launching);
  const running = useLaunchStore((s) => s.running);
  const events = useLaunchStore((s) => s.events);
  const launchError = useLaunchStore((s) => s.error);
  const launch = useLaunchStore((s) => s.launch);
  const resetLaunch = useLaunchStore((s) => s.reset);

  const [diag, setDiag] = useState<DiagResult | null>(null);
  const [diagnosing, setDiagnosing] = useState(false);

  // 进入页面时拉取实例列表
  useEffect(() => {
    void fetchInstances(gameDir);
  }, [gameDir, fetchInstances]);

  // 实例重命名/切换后清空诊断结果
  useEffect(() => {
    setDiag(null);
  }, [currentInstance?.name]);

  // 诊断当前实例（启动环境 + 依赖体检）
  const handleDiagnose = async () => {
    if (!currentInstance) {
      toast.warning("请先选择一个实例");
      return;
    }
    setDiagnosing(true);
    try {
      const result = await diagnoseInstance(currentInstance.name, gameDir);
      setDiag(result);
      toast.success(result.healthy ? "体检通过" : "体检发现问题");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setDiagnosing(false);
    }
  };

  // 启动游戏（走真实启动链路 + 事件流）
  const handleLaunch = async () => {
    if (!currentInstance) {
      toast.warning("请先选择一个实例");
      return;
    }
    await launch(currentInstance.name, gameDir);
    const err = useLaunchStore.getState().error;
    if (err) toast.error(err);
  };

  // 打开实例目录
  const handleOpenDir = async (target: string) => {
    const result = await openPath(target);
    if (result?.error) toast.error(result.error);
  };

  return (
    <div className="max-w-2xl mx-auto p-8">
      <PageHeader title="实例与启动调试" desc="测试实例列表、启动环境体检与真实启动事件流" />

      <div className="space-y-6">
        {/* 实例列表 */}
        <div>
          <GroupTitle>实例列表（{instances.length}）</GroupTitle>
          <div className="space-y-3">
            <GlassCard>
              <SettingRow label="刷新实例列表" desc={`游戏目录：${gameDir || "未配置"}`}>
                <Button size="sm" variant="outline" onClick={() => void fetchInstances(gameDir)} disabled={loading}>
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  刷新
                </Button>
              </SettingRow>
            </GlassCard>

            {instances.length === 0 ? (
              <GlassCard>
                <p className="text-[13px] text-muted-foreground py-1">暂无实例</p>
              </GlassCard>
            ) : (
              instances.map((inst) => {
                const isCurrent = inst.name === currentInstance?.name;
                return (
                  <GlassCard key={inst.name}>
                    <SettingRow
                      label={inst.name}
                      desc={`Minecraft ${inst.config.runtime.minecraft}${inst.healthy ? " · 健康" : " · 存在问题"}`}
                    >
                      <div className="flex items-center gap-2">
                        {isCurrent ? (
                          <Badge variant="outline" className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25">
                            已选中
                          </Badge>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => setCurrent(inst)}>
                            选中
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-muted-foreground"
                          onClick={() => void handleOpenDir(inst.path)}
                        >
                          <FolderOpen className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </SettingRow>
                  </GlassCard>
                );
              })
            )}
          </div>
        </div>

        {/* 启动环境体检 */}
        <div>
          <GroupTitle>启动环境体检</GroupTitle>
          <div className="space-y-3">
            <GlassCard>
              <SettingRow
                label="诊断当前实例"
                desc="解析实际启动版本、资源根与依赖完整性（版本 JSON / JAR / libraries / assets）"
              >
                <Button size="sm" variant="default" onClick={handleDiagnose} disabled={diagnosing || !currentInstance}>
                  {diagnosing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
                  体检
                </Button>
              </SettingRow>
            </GlassCard>

            {diag && (
              <GlassCard>
                <div className="space-y-2 text-[12.5px]">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground/70">健康状态</span>
                    <Badge
                      variant="outline"
                      className={
                        diag.healthy
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25"
                          : "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/25"
                      }
                    >
                      {diag.healthy ? "健康" : "异常"}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground/70">
                    启动版本：<span className="text-foreground font-mono">{diag.launch.versionId}</span>
                    <span className="ml-2 text-muted-foreground/50">（{diag.launch.via}）</span>
                  </p>
                  <p className="text-muted-foreground/70 break-all">
                    资源根：<span className="text-foreground/80 font-mono">{diag.launch.resourceRoot}</span>
                  </p>
                  {diag.launch.loaderLabels.length > 0 && (
                    <p className="text-muted-foreground/70">
                      加载器：<span className="text-foreground/80">{diag.launch.loaderLabels.join(" / ")}</span>
                    </p>
                  )}
                  <p className="text-muted-foreground/70">
                    依赖：{diag.dependency.ready ? "完整" : "缺失"} · 缺失库 {diag.dependency.missingLibraries} 个
                    {diag.dependency.missingJar && " · 缺客户端 JAR"}
                    {diag.dependency.missingAssetIndex && " · 缺资源索引"}
                  </p>
                  {diag.issues.length > 0 && (
                    <div className="text-red-500/80">
                      {diag.issues.map((issue, i) => (
                        <p key={i}>· {issue}</p>
                      ))}
                    </div>
                  )}
                  {diag.launch.warnings.length > 0 && (
                    <div className="text-amber-600/80 dark:text-amber-400/80">
                      {diag.launch.warnings.map((w, i) => (
                        <p key={i}>· {w}</p>
                      ))}
                    </div>
                  )}
                </div>
              </GlassCard>
            )}
          </div>
        </div>

        {/* 启动测试 */}
        <div>
          <GroupTitle>启动测试</GroupTitle>
          <div className="space-y-3">
            <GlassCard>
              <SettingRow
                label={running ? "游戏运行中" : "启动当前实例"}
                desc="使用当前激活账号走真实启动链路，实时输出 stdout / stderr / 窗口就绪 / 进程退出事件"
              >
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="default" onClick={handleLaunch} disabled={launching || !currentInstance}>
                    {launching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                    {launching ? "启动中" : "启动"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={resetLaunch}>
                    重置
                  </Button>
                </div>
              </SettingRow>
            </GlassCard>

            {launchError && (
              <GlassCard>
                <p className="text-[12.5px] text-red-500/80">{launchError}</p>
              </GlassCard>
            )}

            {events.length > 0 && (
              <GlassCard>
                <p className="text-[12px] text-muted-foreground/70 mb-2">事件流（{events.length}）</p>
                <div className="max-h-64 overflow-y-auto scroll-area space-y-0.5">
                  {events.map((e, i) => {
                    const detail =
                      typeof e.message === "string"
                        ? e.message
                        : typeof e.data === "string"
                        ? e.data
                        : "";
                    return (
                      <div key={i} className="flex items-start gap-2 text-[11px] font-mono leading-tight">
                        <span className="text-primary/60 shrink-0">{e.event}</span>
                        <span className="text-foreground/70 break-all">{detail}</span>
                      </div>
                    );
                  })}
                </div>
              </GlassCard>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
