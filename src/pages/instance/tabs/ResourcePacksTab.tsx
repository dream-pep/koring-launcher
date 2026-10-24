import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@heroui/react";
import { AlertCircle, Code2, FolderOpen, Loader2 } from "lucide-react";
import clsx from "clsx";
import { openPath } from "@/api/instance";
import { listInstanceResourcePacks, type ResourcePackInfo } from "@/api/instance-assets";

interface ResourcePacksTabProps {
  instancePath: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function Group({
  title,
  hint,
  items,
  folder,
}: {
  title: string;
  hint: string;
  items: ResourcePackInfo[];
  folder: string;
}) {
  return (
    <section className="space-y-1.5">
      <div className="flex items-center justify-between px-1">
        <div>
          <p className="text-[12px] font-medium text-foreground">
            {title}（{items.length}）
          </p>
          <p className="text-[11px] text-muted-foreground/60">{hint}</p>
        </div>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onPress={() => void openPath(folder)}>
          <FolderOpen className="h-3.5 w-3.5" />
          打开目录
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border/40 px-3 py-4 text-center text-[11px] text-muted-foreground/60 dark:border-white/[0.08]">
          暂无文件
        </p>
      ) : (
        <div className="space-y-1">
          {items.map((item) => (
            <div
              key={`${item.kind}-${item.fileName}`}
              className="flex items-center gap-2.5 rounded-lg border border-border/40 px-2.5 py-2 dark:border-white/[0.08]"
            >
              <Code2 className="h-4 w-4 shrink-0 text-muted-foreground/50" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] text-foreground">{item.rawFileName}</p>
                <p className="truncate font-mono text-[10px] text-muted-foreground/60">{item.fileName}</p>
              </div>
              <span
                className={clsx(
                  "shrink-0 rounded px-1.5 py-0.5 text-[10px]",
                  item.enabled ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-foreground/[0.06] text-muted-foreground dark:bg-white/[0.08]"
                )}
              >
                {item.enabled ? "已启用" : "已禁用"}
              </span>
              <span className="shrink-0 text-[11px] text-muted-foreground/60">{formatSize(item.sizeBytes)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function ResourcePacksTab({ instancePath }: ResourcePacksTabProps) {
  const [items, setItems] = useState<ResourcePackInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await listInstanceResourcePacks(instancePath));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [instancePath]);

  useEffect(() => {
    void load();
  }, [load]);

  const resourcePacks = useMemo(() => items.filter((item) => item.kind === "resourcepack"), [items]);
  const shaderPacks = useMemo(() => items.filter((item) => item.kind === "shaderpack"), [items]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-10 text-[12px] text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        正在扫描 resourcepacks / shaderpacks 目录…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 py-10">
        <AlertCircle className="h-5 w-5 text-muted-foreground/40" />
        <p className="text-[12px] text-muted-foreground">读取资源包失败</p>
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
        <Code2 className="h-6 w-6 text-muted-foreground/30" />
        <p className="text-[12px] text-muted-foreground">还没有资源包或光影包</p>
        <p className="text-[11px] text-muted-foreground/60">把 .zip 放进实例的 resourcepacks / shaderpacks 目录即可</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-[11px] text-muted-foreground/60">
        以 `.disabled` / `.old` 结尾的文件视为已禁用；当前只读展示，启停请在游戏内或手动改名。
      </p>
      <Group
        title="资源包"
        hint="resourcepacks/ 下的 .zip / .jar"
        items={resourcePacks}
        folder={`${instancePath}/resourcepacks`}
      />
      <Group
        title="光影包"
        hint="shaderpacks/ 下的 .zip"
        items={shaderPacks}
        folder={`${instancePath}/shaderpacks`}
      />
    </div>
  );
}
