import { useCallback, useEffect, useMemo, useState } from "react";
import { FolderInput, FolderOpen, Loader2, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { PageShell, type PageShellGroup } from "@/components/page-shell";
import {
  importExistingInstance,
  inspectGameFolder,
  listInstances,
  selectFolder,
  type ScannedVersion,
} from "@/api/instance";
import { openPath } from "@/api/system";
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/lib/toast";
import { InstanceList } from "./InstanceList";
import { useConfigStore } from "@/stores/configStore";

/** 目录显示名：优先用设置页里配置的自定义名称（dirAliases），否则取路径最后一段 */
function folderDisplayName(folder: string, alias?: string): string {
  if (alias) return alias;
  // 相对路径（默认 .minecraft）没有可比对的「最后一段」，直接给个明确的名字，
  // 否则和其它目录（末尾同样是 .minecraft）混在一起分不清谁是谁
  if (!folder.includes("\\") && !folder.includes("/")) return "默认游戏目录";
  const segments = folder.split(/[\\/]+/).filter(Boolean);
  return segments[segments.length - 1] || folder;
}

const sameList = (a: string[], b: string[]) =>
  a.length === b.length && a.every((value, index) => value === b[index]);

/** 加载器 key → 展示名（与设置页徽章保持一致的叫法） */
const LOADER_NAMES: Record<string, string> = {
  forge: "Forge",
  neoforge: "NeoForge",
  fabric: "Fabric",
  quilt: "Quilt",
  optifine: "OptiFine",
};

/** 导入出的实例名：版本号 + 空格 + MOD 加载器名称（无加载器时只留版本号） */
function versionImportName(version: ScannedVersion): string {
  const loader = version.loaders.map((key) => LOADER_NAMES[key] ?? key).join(" + ");
  return loader ? `${version.id} ${loader}` : version.id;
}

/**
 * 实例页。
 *
 * 侧边栏沿用设置页的导航样式：
 * - 「游戏目录」分组列出所有游戏目录，主标题 = 自定义显示名（config.game.dirAliases），
 *   副标题 = 目录路径（过长截断，悬停显示全文）；点击目录 = 设为「当前游戏目录」，
 *   但**列表顺序不变**（顺序记在 config.game.gameDirOrder，不跟着当前目录跑）。
 * - 「添加与导入」分组的「导入已有文件夹」= 调起系统目录选择器，识别为游戏根目录后
 *   把该目录加入列表，并把它 versions/ 下的所有版本导入为实例（名称 = 版本号 + 加载器名），
 *   已经导入过的版本自动跳过（重复点击不会产生副本）。
 *
 * 内容区 = 当前选中目录下的实例列表（见 InstanceList）。
 */
export function InstancePage() {
  const gameDir = useConfigStore((s) => s.config.game.gameDir);
  const gameDirs = useConfigStore((s) => s.config.game.gameDirs);
  const gameDirOrder = useConfigStore((s) => s.config.game.gameDirOrder);
  const dirAliases = useConfigStore((s) => s.config.game.dirAliases);
  const setGame = useConfigStore((s) => s.setGame);

  const mainDir = gameDir || ".minecraft";

  // 导入完成后自增：让已挂载的实例列表重新拉一次数据（新导入的实例立刻出现）
  const [reloadKey, setReloadKey] = useState(0);
  const [importing, setImporting] = useState(false);
  // 每个目录的刷新计数：自增后让对应目录的实例列表重新挂载、重新拉取
  const [refreshTokens, setRefreshTokens] = useState<Record<string, number>>({});
  // 目录右键菜单里的弹层状态
  const [renaming, setRenaming] = useState<{ folder: string; value: string } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // 稳定显示顺序：先按已保存的顺序，新增/缺失的目录再补到末尾
  const folders = useMemo(() => {
    const available = Array.from(new Set([mainDir, ...(gameDirs || [])].filter((p) => !!p)));
    const saved = (gameDirOrder || []).filter((p) => available.includes(p));
    return [...saved, ...available.filter((p) => !saved.includes(p))];
  }, [mainDir, gameDirs, gameDirOrder]);

  // 顺序与配置不一致时（首次启动、设置页增删目录）回写一次，之后切换目录不再改动它
  useEffect(() => {
    if (!sameList(gameDirOrder || [], folders)) setGame({ gameDirOrder: folders });
  }, [gameDirOrder, folders, setGame]);

  /**
   * 导入已有文件夹：选目录 → 识别游戏根目录 → 加入目录列表 → 扫描 versions/ 并批量导入实例。
   * 只导入一次：同版本（launchVersion）或同名实例已存在时跳过。
   */
  const handleImportFolder = useCallback(async () => {
    if (importing) return;

    let picked: { folderPath: string } | null = null;
    try {
      picked = await selectFolder();
    } catch (reason: unknown) {
      toast.error("打开目录选择器失败", {
        description: reason instanceof Error ? reason.message : String(reason),
      });
      return;
    }
    if (!picked) return;

    setImporting(true);
    try {
      const result = await inspectGameFolder(picked.folderPath);
      const target = result.normalized.rootPath || picked.folderPath;
      for (const warning of result.normalized.warnings) toast.warning(warning);

      // 扫描到的版本（没有 JSON 的残缺版本无法导入）
      const versions = result.info.versions.filter((version) => version.hasJson);
      if (versions.length === 0) {
        toast.warning("该文件夹里没有扫描到可导入的版本");
        return;
      }

      // 把目录加入侧边栏（已在列表里就不重复添加，但仍继续导入缺的版本）
      const listed = target === mainDir || (gameDirs || []).includes(target);
      if (!listed) setGame({ gameDirs: [...(gameDirs || []), target] });

      // 导入到「这个目录自己」的 instances/ 下，而不是当前目录：
      // 否则侧边栏选中 A 时内容里会出现 B 的实例，切到 B 又什么都没有。
      const existing = await listInstances(target);
      const takenNames = new Set(existing.map((instance) => instance.name));
      const importedVersions = new Set(
        existing
          .map((instance) => instance.config.launchVersion)
          .filter((id): id is string => !!id),
      );

      let ok = 0;
      let skipped = 0;
      let failed = 0;
      for (const version of versions) {
        const name = versionImportName(version);
        if (takenNames.has(name) || importedVersions.has(version.id)) {
          skipped += 1;
          continue;
        }
        try {
          await importExistingInstance(name, target, version.id, {
            description: `从 ${target} 导入的 ${version.id}`,
            sourceGamePath: target,
            mode: "reference",
          });
          takenNames.add(name);
          importedVersions.add(version.id);
          ok += 1;
        } catch {
          failed += 1;
        }
      }

      // 导入成功就切到这个目录，让用户直接看到刚导入的实例（不成功就保持原选中项）
      if (ok > 0 && target !== mainDir) {
        setGame({
          gameDir: target,
          gameDirs: (gameDirs || []).concat(target).filter((dir) => dir !== target),
        });
      }

      setReloadKey((value) => value + 1);

      if (ok === 0 && failed === 0) {
        toast.info(`没有新的版本需要导入（已导入 ${skipped} 个）`);
      } else {
        const added = listed ? "" : "，已添加到游戏目录列表";
        toast.success(
          `导入完成${added}：成功 ${ok} 个，跳过 ${skipped} 个，失败 ${failed} 个`,
        );
      }
    } catch (reason: unknown) {
      toast.error("导入已有文件夹失败", {
        description: reason instanceof Error ? reason.message : String(reason),
      });
    } finally {
      setImporting(false);
    }
  }, [gameDirs, importing, mainDir, setGame]);

  /** 右键菜单：刷新 —— 重新挂载该目录的实例列表 */
  const handleRefresh = useCallback((folder: string) => {
    setRefreshTokens((prev) => ({ ...prev, [folder]: (prev[folder] ?? 0) + 1 }));
  }, []);

  /** 右键菜单：打开 —— 在系统资源管理器里打开目录 */
  const handleOpenFolder = useCallback(async (folder: string) => {
    const result = await openPath(folder);
    if (!result.success) toast.error("打开目录失败", { description: result.error });
  }, []);

  /** 右键菜单：重命名 —— 只改显示名（config.game.dirAliases），不改磁盘文件夹名 */
  const handleRenameSubmit = useCallback(() => {
    if (!renaming) return;
    const name = renaming.value.trim();
    const nextAliases = { ...(dirAliases || {}) };
    if (name) nextAliases[renaming.folder] = name;
    else delete nextAliases[renaming.folder];
    setGame({ dirAliases: nextAliases });
    setRenaming(null);
    toast.success(name ? `已重命名为「${name}」` : "已恢复默认显示名");
  }, [renaming, dirAliases, setGame]);

  /** 右键菜单：删除 —— 只从列表移除（当前游戏目录不可删），磁盘文件保持不变 */
  const handleDeleteFolder = useCallback(() => {
    if (!deleting) return;
    const folder = deleting;
    const nextAliases = { ...(dirAliases || {}) };
    delete nextAliases[folder];
    setGame({
      gameDirs: (gameDirs || []).filter((dir) => dir !== folder),
      gameDirOrder: (gameDirOrder || []).filter((dir) => dir !== folder),
      dirAliases: nextAliases,
    });
    setDeleting(null);
    toast.success("已从游戏目录列表移除（磁盘文件未删除）");
  }, [deleting, gameDirs, gameDirOrder, dirAliases, setGame]);

  /** 每个目录条目的右键菜单 */
  const folderContextMenu = useCallback(
    (folder: string) => (
      <ContextMenuContent>
        <ContextMenuItem
          onClick={() => setRenaming({ folder, value: dirAliases?.[folder] ?? "" })}
        >
          <Pencil /> 重命名
        </ContextMenuItem>
        <ContextMenuItem onClick={() => void handleOpenFolder(folder)}>
          <FolderOpen /> 打开
        </ContextMenuItem>
        <ContextMenuItem onClick={() => handleRefresh(folder)}>
          <RefreshCw /> 刷新
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          disabled={folder === mainDir}
          className="text-destructive data-highlighted:bg-destructive/10 [&_svg]:text-destructive/70"
          onClick={() => setDeleting(folder)}
        >
          <Trash2 /> 删除
        </ContextMenuItem>
      </ContextMenuContent>
    ),
    [dirAliases, handleOpenFolder, handleRefresh, mainDir],
  );

  const groups = useMemo<PageShellGroup[]>(
    () => [
      {
        title: "游戏目录",
        items: folders.map((folder) => ({
          key: folder,
          label: folderDisplayName(folder, dirAliases?.[folder]),
          description: folder,
          icon: <FolderOpen className="w-[18px] h-[18px] shrink-0" />,
          // 内容区 = 该目录下的实例列表（每个目录一页，PageShell 负责保活与切换动效）
          content: (
            <InstanceList
              key={`${folder}@${reloadKey}:${refreshTokens[folder] ?? 0}`}
              gamePath={folder}
            />
          ),
          contextMenu: folderContextMenu(folder),
        })),
      },
      {
        title: "添加与导入",
        items: [
          {
            key: "import-folder",
            label: importing ? "正在扫描并导入…" : "导入已有文件夹",
            icon: importing ? (
              <Loader2 className="w-[18px] h-[18px] shrink-0 animate-spin" />
            ) : (
              <FolderInput className="w-[18px] h-[18px] shrink-0" />
            ),
            onSelect: () => void handleImportFolder(),
          },
        ],
      },
    ],
    [folders, dirAliases, reloadKey, refreshTokens, importing, handleImportFolder, folderContextMenu],
  );

  const handleChange = useCallback(
    (folder: string) => {
      if (folder === mainDir) return;
      // 只换「当前目录」：新当前目录回到它在列表中的原位，不被顶到最前
      setGame({ gameDir: folder, gameDirs: folders.filter((f) => f !== folder) });
      // toast.success("已设为当前游戏目录");
    },
    [folders, mainDir, setGame],
  );

  return (
    <>
      <PageShell
        groups={groups}
        value={mainDir}
        onValueChange={handleChange}
        navLabel="游戏目录"
      />

      {/* 右键菜单 → 重命名（只改显示名） */}
      <Modal
        open={!!renaming}
        onClose={() => setRenaming(null)}
        className="max-w-sm"
        labelledBy="instance-folder-rename-title"
      >
        <form
          className="p-5"
          onSubmit={(event) => {
            event.preventDefault();
            handleRenameSubmit();
          }}
        >
          <h2 id="instance-folder-rename-title" className="text-[15px] font-semibold">
            重命名游戏目录
          </h2>
          <p className="mt-1 text-[12px] text-muted-foreground">
            只修改列表中的显示名称，不会重命名磁盘上的文件夹。留空则恢复默认名称。
          </p>
          <Input
            autoFocus
            className="mt-4"
            value={renaming?.value ?? ""}
            onChange={(event) =>
              setRenaming((prev) => (prev ? { ...prev, value: event.target.value } : prev))
            }
            placeholder="输入显示名称"
          />
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setRenaming(null)}>
              取消
            </Button>
            <Button type="submit" size="sm">
              保存
            </Button>
          </div>
        </form>
      </Modal>

      {/* 右键菜单 → 删除（只从列表移除，不删磁盘文件） */}
      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        className="max-w-sm"
        labelledBy="instance-folder-delete-title"
      >
        <div className="p-5">
          <h2 id="instance-folder-delete-title" className="text-[15px] font-semibold">
            从游戏目录列表移除
          </h2>
          <p className="mt-1 break-all text-[12px] text-muted-foreground">
            {deleting}：只会从列表里移除，磁盘上的游戏文件不会被删除。
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setDeleting(null)}>
              取消
            </Button>
            <Button type="button" variant="destructive" size="sm" onClick={handleDeleteFolder}>
              移除
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
