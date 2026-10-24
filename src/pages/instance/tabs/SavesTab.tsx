import { useCallback, useEffect, useState } from "react";
import { Button } from "@heroui/react";
import { AlertCircle, FolderOpen, HardDrive, Loader2, Trash2, Archive } from "lucide-react";
import { toast } from "@/lib/toast";
import { openPath } from "@/api/instance";
import {
  backupInstanceSaves,
  deleteInstanceSaves,
  listInstanceSaves,
  type SaveInfo,
} from "@/api/instance-assets";
import { useConfirmDialogStore } from "@/stores/confirmDialogStore";

interface SavesTabProps {
  instancePath: string;
  onChanged: () => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatDate(timestamp: number): string {
  if (!timestamp) return "—";
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function SavesTab({ instancePath, onChanged }: SavesTabProps) {
  const [saves, setSaves] = useState<SaveInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const openConfirm = useConfirmDialogStore((state) => state.openDialog);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSaves(await listInstanceSaves(instancePath));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [instancePath]);

  useEffect(() => {
    void load();
  }, [load]);

  const backup = async (save: SaveInfo) => {
    setBusy(true);
    try {
      const paths = await backupInstanceSaves(instancePath, [save.dirName]);
      toast.success(`已备份到 ${paths[0] ?? "backups/saves"}`, { description: "备份不会自动同步到游戏，需要时手动还原" });
    } catch (e) {
      toast.error(`备份失败：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const remove = (save: SaveInfo) => {
    openConfirm({
      title: "删除存档",
      description: `确定删除存档「${save.levelName || save.dirName}」吗？该目录下的所有文件都会被删除，无法恢复。`,
      confirmLabel: "删除",
      countdown: 3,
      onConfirm: async () => {
        setBusy(true);
        try {
          const result = await deleteInstanceSaves(instancePath, [save.dirName]);
          if (result.deleted.length > 0) toast.success("存档已删除");
          if (result.failed.length > 0) toast.error(`删除失败：${result.failed[0].error}`);
          await load();
          onChanged();
        } catch (e) {
          toast.error(`删除失败：${e instanceof Error ? e.message : String(e)}`);
        } finally {
          setBusy(false);
        }
      },
    });
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-10 text-[12px] text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        正在扫描 saves 目录…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 py-10">
        <AlertCircle className="h-5 w-5 text-muted-foreground/40" />
        <p className="text-[12px] text-muted-foreground">读取存档失败</p>
        <p className="max-w-md text-center text-[11px] text-muted-foreground/60">{error}</p>
        <Button size="sm" variant="ghost" onPress={() => void load()}>
          重试
        </Button>
      </div>
    );
  }

  if (saves.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border/40 py-12 dark:border-white/[0.08]">
        <HardDrive className="h-6 w-6 text-muted-foreground/30" />
        <p className="text-[12px] text-muted-foreground">还没有存档</p>
        <p className="text-[11px] text-muted-foreground/60">进入单人游戏创建世界后会出现在这里</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">共 {saves.length} 个存档 · 按最后修改时间排序</p>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onPress={() => void load()} isDisabled={busy}>
            刷新
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-[11px]"
            onPress={() => void openPath(`${instancePath}/saves`)}
          >
            <FolderOpen className="h-3.5 w-3.5" />
            打开目录
          </Button>
        </div>
      </div>

      {saves.map((save) => (
        <div
          key={save.dirName}
          className="group flex items-center gap-3 rounded-xl border border-border/40 px-3 py-2.5 dark:border-white/[0.08]"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-foreground/[0.05] dark:bg-white/[0.06]">
            {save.iconDataUrl ? (
              <img src={save.iconDataUrl} alt={save.levelName} className="h-full w-full object-cover" />
            ) : (
              <HardDrive className="h-4 w-4 text-muted-foreground/40" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-[13px] font-medium text-foreground">{save.levelName || save.dirName}</span>
              {!save.hasLevelDat && (
                <span className="shrink-0 rounded bg-amber-500/15 px-1 py-0.5 text-[10px] text-amber-600 dark:text-amber-400">
                  可能已损坏
                </span>
              )}
            </div>
            <p className="truncate text-[11px] text-muted-foreground/70">
              {formatSize(save.sizeBytes)} · 最后修改 {formatDate(save.lastModified)}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" isDisabled={busy} onPress={() => void backup(save)}>
              <Archive className="h-3.5 w-3.5" />
              备份
            </Button>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onPress={() => void openPath(save.dirPath)}>
              <FolderOpen className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-[11px] text-destructive"
              isDisabled={busy}
              onPress={() => remove(save)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
