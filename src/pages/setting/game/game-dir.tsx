//  __         __     __   __     ______     __  __     ______        __   __     ______     ______
// /\ \       /\ \   /\ "-.\ \   /\  ___\   /\ \/ /    /\  ___\      /\ "-.\ \   /\  ___\   /\__  _\
// \ \ \____  \ \ \  \ \ \-.  \  \ \ \__ \  \ \  _"-.  \ \  __\      \ \ \-.  \  \ \  __\   \/_/\ \/
//  \ \_____\  \ \_\  \ \_\\"\_\  \ \_____\  \ \_\ \_\  \ \_____\     \ \_\\"\_\  \ \_____\    \ \_\
//   \/_____/   \/_/   \/_/ \/_/   \/_____/   \/_/\/_/   \/_____/      \/_/ \/_/   \/_____/     \/_/
//
// 所有权利归Lingke Network (china)所有 | dream_pep拥有其艺术改变权力
// 未经允许的情况下删除此版权头可能会受到民事指控
// 请勿在未经Lingke Network (china)允许的范围内修改代码并分发

import { useState, useEffect, useCallback } from "react";
import { Button, Skeleton } from "@heroui/react";
import { RefreshCw, FolderOpen, Trash2, Search, Plus, CircleCheck, CircleAlert, Home, Check, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useConfigStore } from "@/stores/configStore";
import { useInstanceStore } from "@/stores/instanceStore";
import { scanGameDir, selectFolder, importExistingInstance, type ScannedVersion } from "@/api/instance";
import { SettingCard, PageHeader, SectionTitle } from "@/components/setting";

// 版本类型标签样式
const TYPE_BADGE: Record<string, { label: string; cls: string }> = {
  release: { label: "正式版", cls: "bg-green-500/10 text-green-600 dark:text-green-400" },
  snapshot: { label: "预览版", cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  "old_alpha": { label: "Alpha", cls: "bg-purple-500/10 text-purple-600 dark:text-purple-400" },
  "old_beta": { label: "Beta", cls: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" },
  unknown: { label: "未知", cls: "bg-foreground/[0.06] dark:bg-white/[0.06] text-muted-foreground" },
};

// 加载器标签样式
const LOADER_BADGE: Record<string, { label: string; cls: string }> = {
  forge: { label: "Forge", cls: "bg-orange-500/10 text-orange-600 dark:text-orange-400" },
  fabric: { label: "Fabric", cls: "bg-sky-500/10 text-sky-600 dark:text-sky-400" },
  quilt: { label: "Quilt", cls: "bg-pink-500/10 text-pink-600 dark:text-pink-400" },
  optifine: { label: "OptiFine", cls: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
};

function getBadge(type: string) {
  return TYPE_BADGE[type] ?? TYPE_BADGE.unknown;
}

function formatTime(iso?: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function FileStatus({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] ${ok ? "text-green-600 dark:text-green-400" : "text-red-500/70"}`}>
      {ok ? <CircleCheck className="w-3 h-3" /> : <CircleAlert className="w-3 h-3" />}
      {label}
    </span>
  );
}

export function GameDirSetting() {
  const game = useConfigStore((s) => s.config.game);
  const setGame = useConfigStore((s) => s.setGame);
  const fetchInstances = useInstanceStore((s) => s.fetchInstances);

  const [scanning, setScanning] = useState(false);
  const [scanTarget, setScanTarget] = useState<string>("");
  const [scanResults, setScanResults] = useState<ScannedVersion[] | null>(null);
  const [importing, setImporting] = useState<string | null>(null); // 正在导入的版本 ID
  const [importingBatch, setImportingBatch] = useState(false);

  const dirs = game.gameDirs ?? [];
  const gameDir = game.gameDir || ".minecraft";

  // 扫描指定目录
  const handleScan = useCallback(async (targetPath?: string) => {
    const scanPath = targetPath || gameDir;
    setScanning(true);
    setScanTarget(scanPath);
    setScanResults(null);
    try {
      const result = await scanGameDir(scanPath);
      setScanResults(result.versions);
      if (result.versions.length === 0) {
        toast.info("未在 versions 目录下发现任何已安装版本");
      } else {
        toast.success(`已扫描到 ${result.versions.length} 个游戏版本`);
      }
    } catch (e: any) {
      toast.error(`扫描失败: ${e.message}`);
    }
    setScanning(false);
  }, [gameDir]);

  // 组件挂载时自动扫描主目录
  useEffect(() => {
    handleScan(gameDir);
  }, []);

  // 主目录变化时自动扫描
  useEffect(() => {
    if (scanTarget && scanTarget !== gameDir) {
      // 目录已变化但还没扫描过新目录
    }
  }, [gameDir]);

  // 导入单个版本
  const handleImport = async (versionId: string) => {
    setImporting(versionId);
    try {
      await importExistingInstance(versionId, gameDir, versionId, {
        description: `Imported from ${gameDir}`,
      });
      await fetchInstances(gameDir);
      toast.success(`已导入版本 ${versionId}`);
    } catch (e: any) {
      toast.error(`导入失败: ${e.message}`);
    }
    setImporting(null);
  };

  // 批量导入所有健康版本
  const handleImportAll = async () => {
    if (!scanResults || scanResults.length === 0) return;
    const healthy = scanResults.filter((v) => v.healthy);
    if (healthy.length === 0) {
      toast.info("没有可导入的健康版本");
      return;
    }
    setImportingBatch(true);
    let success = 0;
    let failed = 0;
    for (const v of healthy) {
      try {
        await importExistingInstance(v.id, gameDir, v.id, {
          description: `Imported from ${gameDir}`,
        });
        success++;
      } catch {
        failed++;
      }
    }
    await fetchInstances(gameDir);
    setImportingBatch(false);
    if (failed === 0) {
      toast.success(`成功导入 ${success} 个版本`);
    } else {
      toast.warning(`导入完成：${success} 成功，${failed} 失败`);
    }
  };

  // 浏览选择主目录
  const handleBrowseMainDir = async () => {
    try {
      const result = await selectFolder();
      if (result?.folderPath) {
        setGame({ gameDir: result.folderPath });
        toast.success(`已设置游戏目录为: ${result.folderPath}`);
      }
    } catch (e: any) {
      toast.error(`选择目录失败: ${e.message}`);
    }
  };

  // 手动添加目录
  const handleAddFolder = async () => {
    try {
      const result = await selectFolder();
      if (result?.folderPath) {
        const p = result.folderPath;
        const current = game.gameDirs ?? [];
        if (current.includes(p)) {
          toast.info("该目录已在列表中");
          return;
        }
        setGame({ gameDirs: [...current, p] });
        toast.success(`已添加目录: ${p}`);
      }
    } catch (e: any) {
      toast.error(`选择目录失败: ${e.message}`);
    }
  };

  // 删除已添加的目录
  const handleRemoveDir = (dir: string) => {
    setGame({ gameDirs: dirs.filter((d) => d !== dir) });
    toast.success("已移除目录");
  };

  // 设为当前游戏目录
  const handleSetAsMain = (dir: string) => {
    setGame({ gameDir: dir });
    toast.success(`已将 ${dir} 设为主游戏目录`);
  };

  // 可导入的健康版本数
  const importableCount = scanResults?.filter((v) => v.healthy).length ?? 0;

  return (
    <div>
      <PageHeader title="游戏目录" desc="管理 Minecraft 游戏的存放位置与发现已安装版本" />

      <div className="space-y-6">
        {/* 主游戏目录配置 */}
        <div>
          <SectionTitle>主游戏目录</SectionTitle>
          <SettingCard>
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium font-mono text-foreground truncate">{gameDir}</p>
                <p className="text-[12px] text-muted-foreground/70 mt-0.5">新实例默认安装到此目录</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button size="sm" variant="outline" onPress={handleBrowseMainDir}>
                  <FolderOpen className="w-3.5 h-3.5" />
                  浏览
                </Button>
                <Button size="sm" variant="outline" onPress={() => handleScan(gameDir)} isDisabled={scanning}>
                  {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  刷新
                </Button>
              </div>
            </div>

            {/* 扫描中骨架屏 */}
            {scanning && scanTarget === gameDir && (
              <div className="mt-4 space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-lg" />
                ))}
              </div>
            )}

            {/* 扫描结果 */}
            {scanResults !== null && scanTarget === gameDir && (
              <div className="mt-4 border-t border-border/30 dark:border-white/[0.05] pt-4">
                {scanResults.length === 0 ? (
                  <p className="text-[13px] text-muted-foreground/70 text-center py-4">
                    未在 versions 目录下发现版本，请确认 Minecraft 已下载到该目录
                  </p>
                ) : (
                  <>
                    {/* 批量操作栏 */}
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[12px] text-muted-foreground/70">
                        发现 {scanResults.length} 个版本，{importableCount} 个可导入
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        onPress={handleImportAll}
                        isDisabled={scanning || importingBatch || importableCount === 0}
                      >
                        {importingBatch ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Download className="w-3.5 h-3.5" />
                        )}
                        全部导入
                      </Button>
                    </div>

                    {/* 版本列表 */}
                    <div className="flex flex-col gap-1.5 max-h-80 overflow-y-auto scroll-area pr-1">
                      {scanResults.map((v) => {
                        const badge = getBadge(v.type);
                        const isImporting = importing === v.id;
                        return (
                          <div
                            key={v.id}
                            className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-foreground/[0.03] dark:bg-white/[0.03] border border-border/20 dark:border-white/[0.04]"
                          >
                            {/* 版本图标 */}
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${badge.cls}`}>
                              <Home className="w-3.5 h-3.5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-[13px] font-mono font-semibold text-foreground">{v.id}</p>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${badge.cls}`}>
                                  {badge.label}
                                </span>
                                {/* 加载器标签 */}
                                {v.loaders.map((loader) => (
                                  <span
                                    key={loader}
                                    className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${LOADER_BADGE[loader]?.cls ?? ""}`}
                                  >
                                    {LOADER_BADGE[loader]?.label ?? loader}
                                  </span>
                                ))}
                                <span className="text-[11px] text-muted-foreground/60">{formatTime(v.releaseTime)}</span>
                              </div>
                              <div className="flex items-center gap-3 mt-1">
                                <FileStatus ok={v.hasJson} label="JSON" />
                                <FileStatus ok={v.hasJar} label="JAR" />
                                {v.loaders.length > 0 && (
                                  <span className="text-[11px] text-muted-foreground/50">
                                    {v.loaders.length} 个加载器
                                  </span>
                                )}
                              </div>
                            </div>
                            {/* 导入按钮 */}
                            <Button
                              size="sm"
                              variant={v.healthy ? "outline" : "ghost"}
                              className="min-w-0 shrink-0"
                              onPress={() => handleImport(v.id)}
                              isDisabled={isImporting || !v.healthy}
                            >
                              {isImporting ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Download className="w-3.5 h-3.5" />
                              )}
                              导入
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
          </SettingCard>
        </div>

        {/* 已添加的目录列表 */}
        <div className="flex items-center justify-between">
          <SectionTitle>已添加目录（{dirs.length}）</SectionTitle>
          <Button size="sm" variant="outline" onPress={handleAddFolder}>
            <Plus className="w-3.5 h-3.5" />
            手动添加
          </Button>
        </div>

        {dirs.length === 0 ? (
          <SettingCard>
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <FolderOpen className="w-7 h-7 text-muted-foreground/25" />
              <p className="text-[13px] text-muted-foreground/70">还没有添加任何游戏目录</p>
              <p className="text-[12px] text-muted-foreground/50">
                使用主目录的"扫描"功能发现已安装版本，或点击"手动添加"选择文件夹
              </p>
            </div>
          </SettingCard>
        ) : (
          <div className="space-y-2">
            {dirs.map((dir) => (
              <SettingCard key={dir}>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-mono font-medium text-foreground truncate">{dir}</p>
                      {dir === gameDir && (
                        <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium shrink-0">
                          <Check className="w-2.5 h-2.5" />
                          当前
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-muted-foreground/70 mt-0.5">已连接的游戏目录</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {dir !== gameDir && (
                      <Button size="sm" variant="ghost" className="min-w-0 h-8 text-[11px] text-muted-foreground" onPress={() => handleSetAsMain(dir)}>
                        <Home className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="min-w-0 h-8 text-[11px] text-muted-foreground" onPress={() => handleScan(dir)} isDisabled={scanning}>
                      <Search className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="danger" className="min-w-0 shrink-0" onPress={() => handleRemoveDir(dir)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {/* 该目录的扫描结果 */}
                {scanning && scanTarget === dir && (
                  <div className="mt-3 space-y-2">
                    {Array.from({ length: 2 }).map((_, i) => (
                      <Skeleton key={i} className="h-8 w-full rounded-lg" />
                    ))}
                  </div>
                )}
                {scanResults !== null && scanTarget === dir && scanTarget !== gameDir && (
                  <div className="mt-3 border-t border-border/30 dark:border-white/[0.05] pt-3">
                    {scanResults.length === 0 ? (
                      <p className="text-[12px] text-muted-foreground/60 py-2">未发现版本文件</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {scanResults.map((v) => {
                          const badge = getBadge(v.type);
                          return (
                            <span key={v.id} className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md bg-foreground/[0.04] dark:bg-white/[0.04]">
                              <span className={`w-1.5 h-1.5 rounded-full ${badge.cls.replace(/\/\d+/, "").replace(/\s.*/, "")}`} />
                              {v.id}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </SettingCard>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
