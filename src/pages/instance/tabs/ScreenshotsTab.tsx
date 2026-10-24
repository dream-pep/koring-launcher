import { useCallback, useEffect, useState } from "react";
import { Button } from "@heroui/react";
import { AlertCircle, FolderOpen, Image as ImageIcon, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { openPath } from "@/api/instance";
import {
  deleteInstanceScreenshots,
  listInstanceScreenshots,
  type ScreenshotInfo,
} from "@/api/instance-assets";
import { useConfirmDialogStore } from "@/stores/confirmDialogStore";

interface ScreenshotsTabProps {
  instancePath: string;
  onChanged: () => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function ScreenshotsTab({ instancePath, onChanged }: ScreenshotsTabProps) {
  const [items, setItems] = useState<ScreenshotInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const openConfirm = useConfirmDialogStore((state) => state.openDialog);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await listInstanceScreenshots(instancePath));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [instancePath]);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = (item: ScreenshotInfo) => {
    openConfirm({
      title: "删除截图",
      description: `确定删除「${item.fileName}」吗？`,
      confirmLabel: "删除",
      countdown: 3,
      onConfirm: async () => {
        setBusy(true);
        try {
          const result = await deleteInstanceScreenshots(instancePath, [item.fileName]);
          if (result.deleted.length > 0) toast.success("截图已删除");
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

  const openFolder = () => {
    void openPath(`${instancePath}/screenshots`);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-10 text-[12px] text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        正在扫描 screenshots 目录…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 py-10">
        <AlertCircle className="h-5 w-5 text-muted-foreground/40" />
        <p className="text-[12px] text-muted-foreground">读取截图失败</p>
        <p className="max-w-md text-center text-[11px] text-muted-foreground/60">{error}</p>
        <Button size="sm" variant="ghost" onPress={() => void load()}>
          重试
        </Button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border/40 py-12 dark:border-white/[0.08]">
        <ImageIcon className="h-6 w-6 text-muted-foreground/30" />
        <p className="text-[12px] text-muted-foreground">还没有截图</p>
        <p className="text-[11px] text-muted-foreground/60">游戏里按 F2 截图后会出现在这里</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">共 {items.length} 张 · 点击缩略图用系统看图工具打开</p>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onPress={() => void load()} isDisabled={busy}>
            刷新
          </Button>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onPress={openFolder}>
            <FolderOpen className="h-3.5 w-3.5" />
            打开目录
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => (
          <div key={item.fileName} className="group relative overflow-hidden rounded-xl border border-border/40 dark:border-white/[0.08]">
            <button
              type="button"
              onClick={() => void openPath(item.filePath)}
              className="block w-full"
              title={item.fileName}
            >
              <div className="aspect-video w-full bg-foreground/[0.04] dark:bg-white/[0.04]">
                {item.thumbDataUrl ? (
                  <img src={item.thumbDataUrl} alt={item.fileName} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <ImageIcon className="h-6 w-6 text-muted-foreground/30" />
                  </div>
                )}
              </div>
              <div className="px-2 py-1.5 text-left">
                <p className="truncate text-[11px] text-foreground">{item.fileName}</p>
                <p className="text-[10px] text-muted-foreground/60">
                  {formatSize(item.sizeBytes)} · {formatDate(item.mtime)}
                </p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => remove(item)}
              disabled={busy}
              className="absolute right-1.5 top-1.5 rounded-md bg-black/50 p-1 text-white/80 opacity-0 transition-opacity hover:bg-destructive hover:text-white group-hover:opacity-100 disabled:opacity-30"
              aria-label={`删除 ${item.fileName}`}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
