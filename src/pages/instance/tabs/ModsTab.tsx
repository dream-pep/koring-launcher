import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@heroui/react";
import { AlertCircle, Loader2, Package, Search, Trash2, X } from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";
import {
  deleteInstanceMods,
  listInstanceMods,
  setInstanceModsEnabled,
  type LocalModInfo,
} from "@/api/instance-mods";
import { useConfirmDialogStore } from "@/stores/confirmDialogStore";
import { Switch } from "@/components/ui/switch";

interface ModsTabProps {
  instancePath: string;
  onChanged: () => void;
}

const LOADER_LABEL: Record<string, string> = {
  fabric: "Fabric",
  quilt: "Quilt",
  forge: "Forge",
  neoforge: "NeoForge",
  unknown: "",
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function ModRow({
  mod,
  checked,
  busy,
  onCheck,
  onToggle,
  onDelete,
}: {
  mod: LocalModInfo;
  checked: boolean;
  busy: boolean;
  onCheck: (checked: boolean) => void;
  onToggle: (enabled: boolean) => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={clsx(
        "group flex items-center gap-2.5 rounded-xl border px-2.5 py-2 transition-colors",
        mod.enabled ? "border-border/40 dark:border-white/[0.08]" : "border-dashed border-border/40 opacity-70 dark:border-white/[0.08]"
      )}
    >
      <input type="checkbox" checked={checked} onChange={(event) => onCheck(event.target.checked)} className="accent-primary" />
      <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-foreground/[0.05] dark:bg-white/[0.06]">
        {mod.iconDataUrl ? (
          <img src={mod.iconDataUrl} alt={mod.displayName} className="h-full w-full object-cover" />
        ) : (
          <Package className="h-4 w-4 text-muted-foreground/40" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[13px] font-medium text-foreground">{mod.displayName}</span>
          {mod.version && <span className="shrink-0 text-[11px] text-muted-foreground/70">{mod.version}</span>}
          {LOADER_LABEL[mod.modLoader] && (
            <span className="shrink-0 rounded bg-foreground/[0.06] px-1 py-0.5 text-[10px] text-muted-foreground dark:bg-white/[0.08]">
              {LOADER_LABEL[mod.modLoader]}
            </span>
          )}
        </div>
        <p className="truncate font-mono text-[10px] text-muted-foreground/60">{mod.fileName}</p>
      </div>
      <span className="shrink-0 text-[11px] text-muted-foreground/60">{formatSize(mod.sizeBytes)}</span>
      <Switch checked={mod.enabled} onCheckedChange={onToggle} disabled={busy} aria-label={`启用 ${mod.displayName}`} />
      <button
        type="button"
        onClick={onDelete}
        disabled={busy}
        className="shrink-0 rounded-md p-1 text-muted-foreground/50 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 disabled:opacity-30"
        aria-label={`删除 ${mod.displayName}`}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function ModsTab({ instancePath, onChanged }: ModsTabProps) {
  const [mods, setMods] = useState<LocalModInfo[]>([]);
  const [disabled, setDisabled] = useState<LocalModInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  /** 列表筛选：全部 / 只看已启用 / 只看已禁用（对齐 PCL 的筛选习惯） */
  const [filter, setFilter] = useState<"all" | "enabled" | "disabled">("all");
  const openConfirm = useConfirmDialogStore((state) => state.openDialog);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listInstanceMods(instancePath);
      setMods(result.mods);
      setDisabled(result.disabled);
      setSelected(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [instancePath]);

  useEffect(() => {
    void load();
  }, [load]);

  const all = useMemo(() => [...mods, ...disabled], [mods, disabled]);

  const applyQuery = (list: LocalModInfo[]) => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return list;
    return list.filter(
      (mod) =>
        mod.displayName.toLowerCase().includes(keyword) ||
        mod.fileName.toLowerCase().includes(keyword) ||
        mod.version.toLowerCase().includes(keyword)
    );
  };

  const visibleMods = filter === "disabled" ? [] : applyQuery(mods);
  const visibleDisabled = filter === "enabled" ? [] : applyQuery(disabled);

  const toggleMany = async (targets: LocalModInfo[], enabled: boolean) => {
    if (targets.length === 0) return;
    setBusy(true);
    try {
      const result = await setInstanceModsEnabled(
        instancePath,
        targets.map((mod) => mod.fileName),
        enabled
      );
      if (result.changed.length > 0) {
        toast.success(`已${enabled ? "启用" : "禁用"} ${result.changed.length} 个模组`);
      }
      if (result.skipped.length > 0) {
        toast.warning(`${result.skipped.length} 个文件已跳过（不存在或重名）`);
      }
      await load();
      onChanged();
    } catch (e) {
      toast.error(`操作失败：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const removeMany = (targets: LocalModInfo[]) => {
    if (targets.length === 0) return;
    openConfirm({
      title: "删除模组",
      description: `确定删除选中的 ${targets.length} 个模组文件吗？文件会直接从磁盘移除，无法恢复。`,
      confirmLabel: "删除",
      countdown: 3,
      onConfirm: async () => {
        setBusy(true);
        try {
          const result = await deleteInstanceMods(
            instancePath,
            targets.map((mod) => mod.fileName)
          );
          if (result.changed.length > 0) toast.success(`已删除 ${result.changed.length} 个模组`);
          if (result.skipped.length > 0) toast.warning(`${result.skipped.length} 个文件跳过`);
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

  const selectedMods = all.filter((mod) => selected.has(mod.fileName));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索模组名 / 文件名 / 版本"
            className="h-8 w-full rounded-lg border border-border/40 bg-white/60 pl-8 pr-7 text-[12px] text-foreground placeholder:text-muted-foreground/50 focus:border-primary/40 dark:border-white/[0.08] dark:bg-black/30"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground"
              aria-label="清空搜索"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <Button size="sm" variant="ghost" onPress={() => void load()} isDisabled={loading} className="h-8 px-2 text-[12px]">
          刷新
        </Button>
      </div>

      {/* 筛选 + 全选 */}
      <div className="flex flex-wrap items-center gap-1.5">
        {(["all", "enabled", "disabled"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setFilter(item)}
            className={clsx(
              "h-7 rounded-md border px-2 text-[11px] transition-colors",
              filter === item
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border/40 text-muted-foreground hover:text-foreground dark:border-white/[0.08]"
            )}
          >
            {item === "all" ? `全部 (${all.length})` : item === "enabled" ? `已启用 (${mods.length})` : `已禁用 (${disabled.length})`}
          </button>
        ))}
        {(visibleMods.length > 0 || visibleDisabled.length > 0) && (
          <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground">
            <input
              type="checkbox"
              className="accent-primary"
              checked={visibleMods.concat(visibleDisabled).every((mod) => selected.has(mod.fileName))}
              onChange={(event) => {
                const names = visibleMods.concat(visibleDisabled).map((mod) => mod.fileName);
                setSelected((previous) => {
                  const next = new Set(previous);
                  for (const name of names) {
                    if (event.target.checked) next.add(name);
                    else next.delete(name);
                  }
                  return next;
                });
              }}
            />
            全选当前
          </label>
        )}
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/[0.06] px-3 py-1.5 text-[12px]">
          <span className="text-foreground">已选 {selected.size} 个</span>
          <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]" isDisabled={busy} onPress={() => void toggleMany(selectedMods, true)}>
            启用
          </Button>
          <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]" isDisabled={busy} onPress={() => void toggleMany(selectedMods, false)}>
            禁用
          </Button>
          <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px] text-destructive" isDisabled={busy} onPress={() => removeMany(selectedMods)}>
            删除
          </Button>
          <button type="button" onClick={() => setSelected(new Set())} className="ml-auto text-muted-foreground hover:text-foreground" aria-label="清空选择">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-10 text-[12px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          正在扫描 mods 目录…
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-2 py-10">
          <AlertCircle className="h-5 w-5 text-muted-foreground/40" />
          <p className="text-[12px] text-muted-foreground">读取模组失败</p>
          <p className="max-w-md text-center text-[11px] text-muted-foreground/60">{error}</p>
          <Button size="sm" variant="ghost" onPress={() => void load()}>
            重试
          </Button>
        </div>
      ) : all.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border/40 py-12 dark:border-white/[0.08]">
          <Package className="h-6 w-6 text-muted-foreground/30" />
          <p className="text-[12px] text-muted-foreground">这个实例还没有安装模组</p>
          <p className="text-[11px] text-muted-foreground/60">可以去「资源」页搜索并安装，文件会落到实例的 mods 目录</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleMods.length > 0 && (
            <section className="space-y-1.5">
              <p className="px-1 text-[11px] text-muted-foreground">已启用（{mods.length}）</p>
              {visibleMods.map((mod) => (
                <ModRow
                  key={mod.fileName}
                  mod={mod}
                  checked={selected.has(mod.fileName)}
                  busy={busy}
                  onCheck={(checked) =>
                    setSelected((previous) => {
                      const next = new Set(previous);
                      if (checked) next.add(mod.fileName);
                      else next.delete(mod.fileName);
                      return next;
                    })
                  }
                  onToggle={(enabled) => void toggleMany([mod], enabled)}
                  onDelete={() => removeMany([mod])}
                />
              ))}
            </section>
          )}

          {visibleDisabled.length > 0 && (
            <section className="space-y-1.5">
              <p className="px-1 text-[11px] text-muted-foreground">已禁用（{disabled.length}）</p>
              {visibleDisabled.map((mod) => (
                <ModRow
                  key={mod.fileName}
                  mod={mod}
                  checked={selected.has(mod.fileName)}
                  busy={busy}
                  onCheck={(checked) =>
                    setSelected((previous) => {
                      const next = new Set(previous);
                      if (checked) next.add(mod.fileName);
                      else next.delete(mod.fileName);
                      return next;
                    })
                  }
                  onToggle={(enabled) => void toggleMany([mod], enabled)}
                  onDelete={() => removeMany([mod])}
                />
              ))}
            </section>
          )}

          {visibleMods.length === 0 && visibleDisabled.length === 0 && (
            <p className="py-8 text-center text-[12px] text-muted-foreground">没有匹配的模组</p>
          )}
        </div>
      )}
    </div>
  );
}
