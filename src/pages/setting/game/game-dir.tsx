import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@heroui/react";
import {
  FolderOpen,
  FolderPlus,
  FolderSearch,
  RefreshCw,
  Trash2,
  Check,
  Loader2,
  Star,
  AlertCircle,
  Copy,
  Link2,
  HardDrive,
  Pencil,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { useConfigStore } from "@/stores/configStore";
import { useInstanceStore } from "@/stores/instanceStore";
import {
  importExistingInstance,
  listInstances,
  selectFolder,
  inspectGameFolder,
  discoverGameFolders,
  openPath,
  type GameFolderInfo,
  type GameFolderCandidate,
  type DiscoveryResult,
  type ImportMode,
  type LauncherKind,
  type ScannedVersion,
} from "@/api/instance";
import {
  PageHeader,
  SectionTitle,
  SettingCard,
  SettingBadge,
  SettingListItem,
  SettingRadioGroup,
  SettingRow,
  type SettingBadgeVariant as BadgeVariant,
} from "@/components/setting";

// 版本类型徽章
const TYPE_BADGE: Record<string, { label: string; variant: BadgeVariant }> = {
  release: { label: "正式版", variant: "success" },
  snapshot: { label: "预览版", variant: "warning" },
  old_alpha: { label: "Alpha", variant: "violet" },
  old_beta: { label: "Beta", variant: "info" },
  unknown: { label: "未知", variant: "neutral" },
};

// 加载器徽章
const LOADER_BADGE: Record<string, { label: string; variant: BadgeVariant }> = {
  forge: { label: "Forge", variant: "warning" },
  neoforge: { label: "NeoForge", variant: "warning" },
  fabric: { label: "Fabric", variant: "info" },
  quilt: { label: "Quilt", variant: "violet" },
  optifine: { label: "OptiFine", variant: "violet" },
};

// 启动器（目录来源）识别结果
const LAUNCHER_META: Record<LauncherKind, { label: string; variant: BadgeVariant }> = {
  koring: { label: "Koring 启动器目录", variant: "primary" },
  official: { label: "官方启动器目录", variant: "info" },
  pcl: { label: "PCL2 目录", variant: "violet" },
  hmcl: { label: "HMCL 目录", variant: "success" },
  prism: { label: "Prism Launcher 目录", variant: "info" },
  multimc: { label: "MultiMC 目录", variant: "info" },
  unknown: { label: "未识别的目录", variant: "neutral" },
};

const KIND_LABEL: Record<GameFolderInfo["kind"], string> = {
  "game-root": "游戏根目录",
  "versions-dir": "versions 子目录",
  "version-dir": "单个版本目录",
  instance: "启动器实例目录",
  unknown: "未识别",
};

function formatTime(time?: string): string {
  if (!time) return "";
  const date = new Date(time);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function FileStatus({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`text-[11px] ${ok ? "text-green-600 dark:text-green-400" : "text-red-500/80"}`}>
      {ok ? "✓" : "✕"} {label}
    </span>
  );
}

export function GameDirSetting() {
  const gameDir = useConfigStore((s) => s.config.game.gameDir);
  const gameDirs = useConfigStore((s) => s.config.game.gameDirs);
  const resourceDir = useConfigStore((s) => s.config.game.resourceDir);
  const dirAliases = useConfigStore((s) => s.config.game.dirAliases);
  const setGame = useConfigStore((s) => s.setGame);

  const instances = useInstanceStore((s) => s.instances);
  const fetchInstances = useInstanceStore((s) => s.fetchInstances);

  // 目录识别结果缓存：路径 → GameFolderInfo
  const [infos, setInfos] = useState<Record<string, GameFolderInfo | null>>({});
  const [scanning, setScanning] = useState<string | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [discovery, setDiscovery] = useState<DiscoveryResult | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>("reference");
  const [importing, setImporting] = useState<Record<string, boolean>>({});
  const [importingBatch, setImportingBatch] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  /** 正在重命名的目录（显示名）与新名称 */
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const mainDir = gameDir || ".minecraft";
  const folders = useMemo(
    () => Array.from(new Set([mainDir, ...(gameDirs || [])].filter((p) => !!p))),
    [mainDir, gameDirs]
  );
  const importedNames = useMemo(() => new Set(instances.map((i) => i.name)), [instances]);

  // ---------- 识别 ----------
  const recognize = useCallback(async (target: string) => {
    setScanning(target);
    try {
      const { info } = await inspectGameFolder(target);
      setInfos((prev) => ({ ...prev, [target]: info }));
      return info;
    } catch (e: any) {
      setInfos((prev) => ({ ...prev, [target]: null }));
      toast.error(`识别失败: ${e?.message || e}`);
      return null;
    } finally {
      setScanning(null);
    }
  }, []);

  // 挂载 / 目录变化时自动识别（PCL2 式：选中目录即识别）
  useEffect(() => {
    for (const folder of folders) {
      if (!(folder in infos)) {
        void recognize(folder);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folders.join("|")]);

  useEffect(() => {
    void fetchInstances(mainDir).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainDir]);

  // ---------- 目录管理 ----------
  const handleAddFolder = useCallback(async () => {
    const picked = await selectFolder();
    if (!picked) return;

    const pickedPath = picked.folderPath;
    let info: GameFolderInfo | null = null;
    try {
      const result = await inspectGameFolder(pickedPath);
      info = result.info;
      const target = result.normalized.rootPath || pickedPath;

      for (const warning of result.normalized.warnings) {
        toast.warning(warning);
      }

      if (target === mainDir || (gameDirs || []).includes(target)) {
        toast.info("该目录已在列表中");
        setInfos((prev) => ({ ...prev, [target]: info }));
        return;
      }

      setGame({ gameDirs: [...(gameDirs || []), target] });
      setInfos((prev) => ({ ...prev, [target]: info }));

      const meta = LAUNCHER_META[info.launcher];
      const changed = result.normalized.rootPath && result.normalized.rootPath !== pickedPath;
      toast.success(
        `${changed ? "已从子目录上溯到游戏根目录：" : ""}识别为${meta.label}，共 ${info.versionCount} 个版本（${info.healthyCount} 个可用）`
      );
    } catch (e: any) {
      toast.error(`识别失败: ${e?.message || e}`);
    }
  }, [gameDirs, mainDir, setGame]);

  const handleRemoveDir = useCallback(
    (target: string) => {
      setGame({ gameDirs: (gameDirs || []).filter((d) => d !== target) });
    },
    [gameDirs, setGame]
  );

  const handleSetAsMain = useCallback(
    (target: string) => {
      const rest = folders.filter((f) => f !== target);
      setGame({ gameDir: target, gameDirs: rest });
      toast.success("已设为当前游戏目录");
    },
    [folders, setGame]
  );

  /** 目录显示名（只改展示，不改磁盘路径）；空值 = 恢复显示路径 */
  const handleRename = useCallback(
    (target: string, value: string) => {
      const next: Record<string, string> = { ...(dirAliases || {}) };
      const trimmed = value.trim();
      if (trimmed) next[target] = trimmed;
      else delete next[target];
      setGame({ dirAliases: next });
      setRenaming(null);
      setRenameValue("");
      toast.success(trimmed ? "已重命名目录" : "已恢复显示路径");
    },
    [dirAliases, setGame]
  );

  /** 上移 / 下移（当前目录固定首位，只重排额外目录） */
  const handleMove = useCallback(
    (target: string, direction: -1 | 1) => {
      const list = folders.filter((folder) => folder !== mainDir);
      const index = list.indexOf(target);
      const swapIndex = index + direction;
      if (index < 0 || swapIndex < 0 || swapIndex >= list.length) return;
      const next = [...list];
      [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
      setGame({ gameDirs: next });
    },
    [folders, mainDir, setGame]
  );

  const handleOpen = useCallback(async (target: string) => {
    try {
      const { error } = await openPath(target);
      if (error) toast.error(`无法打开目录: ${error}`);
    } catch (e: any) {
      toast.error(`无法打开目录: ${e?.message || e}`);
    }
  }, []);

  const handleBrowseResourceDir = useCallback(async () => {
    const picked = await selectFolder();
    if (!picked) return;
    setGame({ resourceDir: picked.folderPath });
    toast.success("已设置共享资源目录");
  }, [setGame]);

  // ---------- 自动查找 ----------
  const handleDiscover = useCallback(async () => {
    setDiscovering(true);
    try {
      const result = await discoverGameFolders(folders);
      setDiscovery(result);
      if (result.candidates.length === 0) {
        toast.info("未发现新的游戏目录，可手动添加");
      } else {
        toast.success(`发现 ${result.candidates.length} 个候选目录`);
      }
    } catch (e: any) {
      toast.error(`查找失败: ${e?.message || e}`);
    }
    setDiscovering(false);
  }, [folders]);

  const handleAddCandidate = useCallback(
    async (candidate: GameFolderCandidate) => {
      if (folders.includes(candidate.path)) return;
      setGame({ gameDirs: [...(gameDirs || []), candidate.path] });
      toast.success(`已添加 ${candidate.label}`);
      void recognize(candidate.path);
    },
    [folders, gameDirs, setGame, recognize]
  );

  // ---------- 导入 ----------
  const handleImport = useCallback(
    async (source: string, versionId: string) => {
      setImporting((prev) => ({ ...prev, [versionId]: true }));
      try {
        await importExistingInstance(versionId, mainDir, versionId, {
          description: `Imported from ${source}`,
          sourceGamePath: source,
          mode: importMode,
        });
        toast.success(`已导入实例「${versionId}」`);
        await fetchInstances(mainDir).catch(() => {});
      } catch (e: any) {
        toast.error(`导入「${versionId}」失败: ${e?.message || e}`);
      }
      setImporting((prev) => ({ ...prev, [versionId]: false }));
    },
    [mainDir, importMode, fetchInstances]
  );

  const handleImportAll = useCallback(
    async (source: string, versions: ScannedVersion[]) => {
      setImportingBatch(source);
      let ok = 0;
      let skipped = 0;
      let failed = 0;
      try {
        const existing = await listInstances(mainDir);
        const names = new Set(existing.map((i) => i.name));
        for (const version of versions) {
          if (names.has(version.id)) {
            skipped += 1;
            continue;
          }
          try {
            await importExistingInstance(version.id, mainDir, version.id, {
              description: `Imported from ${source}`,
              sourceGamePath: source,
              mode: importMode,
            });
            names.add(version.id);
            ok += 1;
          } catch {
            failed += 1;
          }
        }
        await fetchInstances(mainDir).catch(() => {});
        toast.success(`批量导入完成：成功 ${ok} 个，跳过 ${skipped} 个，失败 ${failed} 个`);
      } catch (e: any) {
        toast.error(`批量导入失败: ${e?.message || e}`);
      }
      setImportingBatch(null);
    },
    [mainDir, importMode, fetchInstances]
  );

  return (
    <div>
      <PageHeader
        title="游戏目录"
        desc="识别并管理游戏版本文件夹（兼容官方启动器 / PCL2 / HMCL / Prism 等目录结构）"
      />

      <div className="space-y-6">
        {/* 自动查找 */}
        <div>
          <SectionTitle>自动查找</SectionTitle>
          <SettingCard>
            <div className="space-y-3">
              <SettingRow
                label="扫描本机常见位置"
                desc="查找 .minecraft、PCL / HMCL 数据目录、各盘符根目录下的游戏目录"
              >
                <Button size="sm" variant="outline" onPress={handleDiscover} isDisabled={discovering}>
                  {discovering ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <FolderSearch className="w-3.5 h-3.5" />
                  )}
                  {discovering ? "查找中..." : "自动查找"}
                </Button>
              </SettingRow>

              {discovery && (
                <div className="space-y-1.5">
                  <p className="text-[12px] text-muted-foreground/70">
                    候选目录（已探测 {discovery.scanned} 个位置）
                  </p>
                  {discovery.candidates.length === 0 ? (
                    <p className="text-[12px] text-muted-foreground">没有发现新的游戏目录</p>
                  ) : (
                    discovery.candidates.map((candidate) => (
                      <SettingListItem key={candidate.path}>
                        <HardDrive className="w-4 h-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-foreground">{candidate.label}</p>
                            <SettingBadge variant={LAUNCHER_META[candidate.launcher].variant}>
                              {LAUNCHER_META[candidate.launcher].label}
                            </SettingBadge>
                          </div>
                          <p className="text-[11px] text-muted-foreground/60 mt-0.5 font-mono truncate">
                            {candidate.path}
                          </p>
                        </div>
                        <span className="text-[12px] text-muted-foreground shrink-0">
                          {candidate.versionCount} 个版本
                          {candidate.healthyCount < candidate.versionCount &&
                            `（${candidate.healthyCount} 可用）`}
                        </span>
                        <Button size="sm" variant="outline" onPress={() => handleAddCandidate(candidate)}>
                          添加
                        </Button>
                      </SettingListItem>
                    ))
                  )}
                </div>
              )}
            </div>
          </SettingCard>
        </div>

        {/* 主目录 + 共享资源目录 */}
        <div>
          <SectionTitle>目录设置</SectionTitle>
          <div className="space-y-3">
            <SettingCard>
              <div className="space-y-3">
                <SettingRow
                  label="当前游戏目录"
                  desc="实例创建、导入与启动都以该目录为基准（instances/ 与 versions/ 位于其中）"
                >
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onPress={() => handleOpen(mainDir)}>
                      <FolderOpen className="w-3.5 h-3.5" />
                      打开
                    </Button>
                    <Button size="sm" variant="outline" onPress={handleAddFolder}>
                      <FolderPlus className="w-3.5 h-3.5" />
                      添加目录
                    </Button>
                  </div>
                </SettingRow>
                <p className="text-[12px] text-muted-foreground font-mono break-all">{mainDir}</p>
              </div>
            </SettingCard>

            <SettingCard>
              <div className="space-y-3">
                <SettingRow
                  label="共享资源目录"
                  desc="留空则实例自带 versions / libraries / assets；填写后实例缺少资源时回退到该目录（适合与官方启动器共用）"
                >
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onPress={handleBrowseResourceDir}>
                      <FolderOpen className="w-3.5 h-3.5" />
                      选择
                    </Button>
                    {resourceDir && (
                      <>
                        <Button size="sm" variant="outline" onPress={() => handleOpen(resourceDir)}>
                          打开
                        </Button>
                        <Button size="sm" variant="outline" onPress={() => setGame({ resourceDir: "" })}>
                          清除
                        </Button>
                      </>
                    )}
                  </div>
                </SettingRow>
                <p className="text-[12px] text-muted-foreground font-mono break-all">
                  {resourceDir || "未设置（实例自包含）"}
                </p>
              </div>
            </SettingCard>
          </div>
        </div>

        {/* 导入方式 */}
        <div>
          <SectionTitle>导入方式</SectionTitle>
          <SettingCard>
            <div className="space-y-3">
              <SettingRadioGroup
                value={importMode}
                horizontal
                onChange={(v) => setImportMode(v as ImportMode)}
                options={[
                  { value: "reference", label: "引用源目录（推荐）" },
                  { value: "copy", label: "复制到实例目录" },
                ]}
              />
              <p className="text-[12px] text-muted-foreground flex items-center gap-1.5">
                {importMode === "reference" ? (
                  <>
                    <Link2 className="w-3.5 h-3.5" />
                    不复制文件，实例直接使用源目录的版本 / 库 / 资源文件，占用最少；源目录被删除后实例将无法启动
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    复制版本文件到实例目录，必要目录以链接方式共享；占用更多空间，但实例可独立使用
                  </>
                )}
              </p>
            </div>
          </SettingCard>
        </div>

        {/* 目录列表 */}
        <div>
          <SectionTitle>已添加的目录</SectionTitle>
          <div className="space-y-3">
            {folders.map((folder) => {
              const info = infos[folder];
              const isMain = folder === mainDir;
              const isLoading = scanning === folder;
              const versions = info?.versions ?? [];
              const shown = versions.slice(0, expanded[folder] ? versions.length : 12);
              const meta = info ? LAUNCHER_META[info.launcher] : null;
              const extraDirs = folders.filter((f) => f !== mainDir);
              const pos = extraDirs.indexOf(folder);

              return (
                <SettingCard key={folder}>
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {renaming === folder ? (
                            <div className="flex items-center gap-1.5">
                              <input
                                value={renameValue}
                                onChange={(event) => setRenameValue(event.target.value)}
                                placeholder="显示名称（留空恢复路径）"
                                autoFocus
                                className="h-7 w-52 rounded-md border border-border/40 bg-white/60 px-2 text-[12px] text-foreground dark:border-white/[0.08] dark:bg-black/30"
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") handleRename(folder, renameValue);
                                  if (event.key === "Escape") setRenaming(null);
                                }}
                              />
                              <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onPress={() => handleRename(folder, renameValue)}>
                                保存
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onPress={() => setRenaming(null)}>
                                取消
                              </Button>
                            </div>
                          ) : (
                            <p className="text-sm font-medium text-foreground break-all">
                              {dirAliases?.[folder] || folder}
                            </p>
                          )}
                          {isMain && (
                            <SettingBadge variant="success">
                              <Star className="w-3 h-3" />
                              当前
                            </SettingBadge>
                          )}
                          {meta && <SettingBadge variant={meta.variant}>{meta.label}</SettingBadge>}
                          {info && info.kind !== "game-root" && (
                            <SettingBadge variant="neutral">{KIND_LABEL[info.kind]}</SettingBadge>
                          )}
                        </div>

                        {dirAliases?.[folder] && renaming !== folder && (
                          <p className="mt-0.5 break-all font-mono text-[11px] text-muted-foreground/60">{folder}</p>
                        )}

                        {isLoading ? (
                          <p className="text-[12px] text-muted-foreground mt-1 flex items-center gap-1">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            正在识别目录结构...
                          </p>
                        ) : info ? (
                          <div className="mt-1 space-y-1">
                            <p className="text-[12px] text-muted-foreground">
                              共 {info.versionCount} 个版本
                              <span className="text-green-600 dark:text-green-400"> · {info.healthyCount} 个可用</span>
                              {info.summary.broken > 0 && (
                                <span className="text-red-500/80"> · {info.summary.broken} 个缺少文件</span>
                              )}
                              {info.hasLibraries && " · 含 libraries"}
                              {info.hasAssets && " · 含 assets"}
                            </p>
                            {Object.keys(info.summary.loaders).length > 0 && (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {Object.entries(info.summary.loaders).map(([loader, count]) => (
                                  <SettingBadge key={loader} variant={LOADER_BADGE[loader]?.variant ?? "neutral"}>
                                    {LOADER_BADGE[loader]?.label ?? loader} × {count}
                                  </SettingBadge>
                                ))}
                              </div>
                            )}
                            {info.warnings.map((warning) => (
                              <p key={warning} className="text-[12px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                {warning}
                              </p>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[12px] text-red-500/80 mt-1">目录不可用或无法识别</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Button size="sm" variant="outline" onPress={() => recognize(folder)} isDisabled={isLoading}>
                          <RefreshCw className="w-3.5 h-3.5" />
                          重新识别
                        </Button>
                        <Button size="sm" variant="outline" onPress={() => handleOpen(folder)}>
                          <FolderOpen className="w-3.5 h-3.5" />
                          打开
                        </Button>
                        {!isMain && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              aria-label="重命名（仅显示名）"
                              onPress={() => {
                                setRenaming(folder);
                                setRenameValue(dirAliases?.[folder] ?? "");
                              }}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="sm" variant="outline" aria-label="上移" isDisabled={pos <= 0} onPress={() => handleMove(folder, -1)}>
                              <ChevronUp className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              aria-label="下移"
                              isDisabled={pos < 0 || pos >= extraDirs.length - 1}
                              onPress={() => handleMove(folder, 1)}
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="sm" variant="outline" onPress={() => handleSetAsMain(folder)}>
                              设为当前
                            </Button>
                            <Button size="sm" variant="outline" onPress={() => handleRemoveDir(folder)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* 版本列表 */}
                    {info && versions.length > 0 && (
                      <div className="space-y-1.5 pt-1 border-t border-border/40 dark:border-white/[0.06]">
                        <div className="flex items-center justify-between pt-2">
                          <p className="text-[12px] text-muted-foreground/70">
                            版本列表（{versions.length}）
                          </p>
                          <Button
                            size="sm"
                            variant="outline"
                            isDisabled={importingBatch === folder || versions.length === 0}
                            onPress={() => handleImportAll(folder, versions)}
                          >
                            {importingBatch === folder ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                            全部导入
                          </Button>
                        </div>

                        {shown.map((version) => {
                          const type = TYPE_BADGE[version.type] ?? TYPE_BADGE.unknown;
                          const imported = importedNames.has(version.id);
                          const busy = !!importing[version.id];
                          return (
                            <SettingListItem key={version.id} selected={imported}>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm font-medium text-foreground font-mono">{version.id}</p>
                                  <SettingBadge variant={type.variant}>{type.label}</SettingBadge>
                                  {version.loaders.map((loader) => (
                                    <SettingBadge key={loader} variant={LOADER_BADGE[loader]?.variant ?? "neutral"}>
                                      {LOADER_BADGE[loader]?.label ?? loader}
                                    </SettingBadge>
                                  ))}
                                  {!version.healthy && (
                                    <SettingBadge variant="error">
                                      文件不完整
                                    </SettingBadge>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 mt-0.5">
                                  <span className="text-[11px] text-muted-foreground/60">
                                    {formatTime(version.releaseTime)}
                                  </span>
                                  <FileStatus ok={version.hasJson} label="JSON" />
                                  <FileStatus ok={version.hasJar} label="JAR" />
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant={imported ? "primary" : "outline"}
                                className="shrink-0"
                                isDisabled={imported || busy}
                                onPress={() => handleImport(folder, version.id)}
                              >
                                {busy ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : imported ? (
                                  <>
                                    <Check className="w-3.5 h-3.5" />
                                    已导入
                                  </>
                                ) : (
                                  "导入"
                                )}
                              </Button>
                            </SettingListItem>
                          );
                        })}

                        {versions.length > 12 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="w-full"
                            onPress={() => setExpanded((prev) => ({ ...prev, [folder]: !prev[folder] }))}
                          >
                            {expanded[folder] ? "收起" : `展开全部 ${versions.length} 个版本`}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </SettingCard>
              );
            })}
          </div>
        </div>

        <p className="text-[12px] text-muted-foreground/70">
          提示：导入的实例会出现在「实例管理」中，可直接启动；若实例依赖源目录的资源，请在启动前保持源目录可用。
        </p>
      </div>
    </div>
  );
}

