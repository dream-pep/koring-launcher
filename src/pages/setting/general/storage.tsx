/**
 * 设置 → 通用 → 存储
 * 苹果存储页风格的单栏布局：顶部是一条横向分段长条，按类别占比显示磁盘占用分布；
 * 长条与下方明细行双向联动（悬停某个类别时其余段变淡），明细按
 * 软件数据 / 实例占用 / Koring Device 数据 / 保密数据 / 其他数据 分类列出。
 * 数据来自主进程异步扫描（storage:scan），进度经 storage:progress 节流推送。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDownToLine,
  Boxes,
  Cpu,
  Database,
  File,
  Folder,
  FolderOpen,
  FolderSymlink,
  Globe,
  HardDrive,
  Image,
  KeyRound,
  Layers,
  Loader2,
  Plug,
  RotateCw,
  ScrollText,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  Wifi,
  type LucideIcon,
} from "lucide-react";
import { PageHeader, SectionTitle, SettingCard } from "@/components/setting";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { openPath } from "@/api/system";
import {
  scanStorage,
  onStorageProgress,
  type StorageEntry,
  type StorageReport,
  type StorageScanProgress,
  type StorageSection,
  type StorageSlice,
  type StorageTone,
} from "@/api/storage";

// ==================== 配色与格式化 ====================

/** device / secure / other 三组在长条中各聚合为一片，切片 id 固定为 section:<id>（与主进程 electron/core/storage.ts 一致） */
function isGroupSection(sectionId: StorageSection["id"]): boolean {
  return sectionId === "device" || sectionId === "secure" || sectionId === "other";
}

function groupSliceId(sectionId: StorageSection["id"]): string {
  return `section:${sectionId}`;
}

/** 固定类别基础色（软件数据 / Koring Device 数据 / 保密数据 / 其他数据） */
const TONE_BASE: Record<Exclude<StorageTone, "instance">, string> = {
  cache: "#38bdf8",
  online: "#a78bfa",
  update: "#fbbf24",
  device: "#10b981",
  secure: "#ef4444",
  other: "#a1a1aa",
};

/** 安装位置色板：按下标取色（超出循环） */
const LOCATION_PALETTE = [
  "#34d399",
  "#22d3ee",
  "#e879f9",
  "#818cf8",
  "#fb7185",
  "#a3e635",
  "#fb923c",
  "#2dd4bf",
  "#f472b6",
  "#60a5fa",
];

function sliceColor(tone: StorageTone, colorIndex?: number): string {
  if (tone === "instance") return LOCATION_PALETTE[(colorIndex ?? 0) % LOCATION_PALETTE.length];
  return TONE_BASE[tone];
}

/** 分类标题图标 */
const SECTION_ICONS: Record<string, LucideIcon> = {
  software: HardDrive,
  instances: Boxes,
  device: Cpu,
  secure: ShieldCheck,
  other: FolderOpen,
};

/** 条目图标（按条目 id / 归并 key 取，未命中用文件夹兜底） */
const ENTRY_ICONS: Record<string, LucideIcon> = {
  // 软件数据
  cache: Layers,
  online: Wifi,
  update: ArrowDownToLine,
  // 实例占用
  instance: Boxes,
  shared: FolderSymlink,
  // Koring Device 数据
  protocol: Plug,
  config: Settings2,
  preferences: SlidersHorizontal,
  logs: ScrollText,
  index: Database,
  custom: Image,
  local: HardDrive,
  // 保密数据
  auth: KeyRound,
  accounts: Users,
  network: Globe,
  // 其他数据
  "resource-dir": FolderOpen,
};

/** 条目 id → 图标 key（与主进程 electron/core/storage.ts 的 id 规则对应） */
function entryIconKey(id: string): string {
  if (id.startsWith("other:device:")) return id.slice("other:device:".length);
  if (id.startsWith("other:secure:")) return id.slice("other:secure:".length);
  if (id.startsWith("software:")) return id.split(":")[1] ?? "";
  if (id.startsWith("cache:")) return "cache";
  if (id.startsWith("online:")) return "online";
  if (id.startsWith("location:")) return id.endsWith(":shared") ? "shared" : "instance";
  if (id === "other:resource-dir") return "resource-dir";
  return "";
}

/** 条目图标：归并条目/目录按 key 取；未知条目按是否有子资源用文件夹/文件兜底 */
function entryIcon(entry: Pick<StorageEntry, "id" | "children">): LucideIcon {
  const icon = ENTRY_ICONS[entryIconKey(entry.id)];
  if (icon) return icon;
  return entry.children.length > 0 ? Folder : File;
}

/** 长条切片图标：分组片用分类图标，逐条目片用条目图标 */
function sliceIcon(slice: StorageSlice): LucideIcon {
  if (slice.id.startsWith("section:")) return SECTION_ICONS[slice.id.slice("section:".length)] ?? FolderOpen;
  return ENTRY_ICONS[entryIconKey(slice.id)] ?? Folder;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  if (unit === 0) return `${Math.round(value)} B`;
  const digits = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits)} ${units[unit]}`;
}

function formatPercent(bytes: number, total: number): string {
  if (total <= 0 || bytes <= 0) return "—";
  const pct = (bytes / total) * 100;
  if (pct >= 99.5) return "100%";
  if (pct >= 10) return `${pct.toFixed(0)}%`;
  return `${pct.toFixed(1)}%`;
}

// ==================== 行组件 ====================

interface EntryRowProps {
  entry: StorageEntry;
  /** 分组分类（device / secure / other）行的悬停联动切片 id；逐条目分类不传 */
  sectionSliceId?: string;
  /** 是否显示「打开目录」按钮（归并类条目没有唯一目录，子资源行另有入口） */
  showOpen?: boolean;
  total: number;
  hoveredId: string | null;
  onHover: (id: string | null) => void;
  onOpen: (path: string) => void;
}

/** 顶层条目行：色点 + 名称/说明 + 占用/占比 + 打开目录；子条目缩进列出 */
function EntryRow({ entry, sectionSliceId, showOpen = true, total, hoveredId, onHover, onOpen }: EntryRowProps) {
  const color = sliceColor(entry.tone, entry.colorIndex);
  const Icon = entryIcon(entry);
  const hovered = hoveredId === entry.id || (sectionSliceId !== undefined && hoveredId === sectionSliceId);
  const dimmed = hoveredId !== null && !hovered;

  return (
    <div
      className={cn(
        "px-4 py-3 transition-[background-color,opacity] duration-150 hover:bg-muted/50",
        hovered && "bg-muted/60",
        dimmed && "opacity-40",
      )}
      onMouseEnter={() => onHover(entry.id)}
      onMouseLeave={() => onHover(null)}
    >
      <div className="flex items-center gap-3">
        <span
          className="flex size-6 shrink-0 items-center justify-center rounded-md"
          style={{ backgroundColor: `${color}1f`, color }}
        >
          <Icon className="size-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="truncate text-[13px] font-medium text-foreground">{entry.label}</span>
            {entry.detail && <span className="truncate text-[11px] text-muted-foreground">{entry.detail}</span>}
          </div>
        </div>
        <div className="shrink-0 text-right tabular-nums">
          <div className="text-[13px] font-semibold text-foreground">{formatBytes(entry.bytes)}</div>
          <div className="text-[11px] text-muted-foreground">{formatPercent(entry.bytes, total)}</div>
        </div>
        {showOpen && (
          <Button
            variant="ghost"
            size="icon-xs"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => onOpen(entry.path)}
            title="打开目录"
            aria-label={`打开 ${entry.label} 所在目录`}
          >
            <FolderOpen />
          </Button>
        )}
      </div>
      {entry.children.length > 0 && (
        <div className="mt-2 space-y-0.5 pl-[22px]">
          {entry.children.map((child) => (
            <ChildRow
              key={child.id}
              child={child}
              color={color}
              hovered={hoveredId === child.id}
              onHover={onHover}
              onOpen={onOpen}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ChildRow({
  child,
  color,
  hovered,
  onHover,
  onOpen,
}: {
  child: StorageEntry;
  color: string;
  hovered: boolean;
  onHover: (id: string | null) => void;
  onOpen: (path: string) => void;
}) {
  return (
    <div
      className={cn(
        "group flex items-center gap-2 rounded-md px-1.5 py-0.5 transition-colors duration-150 hover:bg-muted/50",
        hovered && "bg-muted/50",
      )}
      onMouseEnter={() => onHover(child.id)}
      onMouseLeave={() => onHover(null)}
    >
      <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: color, opacity: 0.75 }} />
      <span className="min-w-0 flex-1 truncate text-[12px] text-muted-foreground">
        {child.label}
        {child.detail && <span className="ml-1.5 text-[11px] text-muted-foreground/70">{child.detail}</span>}
      </span>
      <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{formatBytes(child.bytes)}</span>
      <button
        type="button"
        className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-foreground"
        onClick={() => onOpen(child.path)}
        title="打开目录"
        aria-label={`打开 ${child.label} 所在目录`}
      >
        <FolderOpen className="size-3" />
      </button>
    </div>
  );
}

// ==================== 页面 ====================

export function StorageSetting() {
  const [report, setReport] = useState<StorageReport | null>(null);
  const [progress, setProgress] = useState<StorageScanProgress | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);

  const scanningRef = useRef(false);
  const startedRef = useRef(false);

  const runScan = useCallback(async () => {
    if (scanningRef.current) return;
    scanningRef.current = true;
    setScanning(true);
    setError(null);
    setProgress(null);
    try {
      const data = await scanStorage();
      setReport(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      scanningRef.current = false;
      setScanning(false);
      setProgress(null);
    }
  }, []);

  // 首次挂载自动统计一次（ref 防御 StrictMode 双触发；主进程另有并发去重兜底）
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void runScan();
    const unsub = onStorageProgress(setProgress);
    return () => {
      unsub();
      startedRef.current = false;
    };
  }, [runScan]);

  const openFolder = useCallback((target: string) => {
    openPath(target).catch((e: unknown) => {
      toast.error(e instanceof Error ? e.message : String(e));
    });
  }, []);

  // 长条数据：零占用的类别不进条；全空时放一个占位灰段
  const isEmpty = !report || report.totalBytes <= 0;
  const chartData = useMemo<StorageSlice[]>(() => {
    if (!report) return [];
    const slices = report.slices.filter((s) => s.bytes > 0);
    if (slices.length > 0) return slices;
    return [{ id: "placeholder", label: "暂无数据", bytes: 1, tone: "other" }];
  }, [report]);

  /** 段宽分母：按条内各项之和归一，保证长条始终填满（全空时兜底 1） */
  const barTotal = chartData.reduce((sum, s) => sum + s.bytes, 0) || 1;

  /** 悬停联动：悬停长条段 → 该段；悬停分组分类（device / secure / other）的明细行/子资源行 → 该组聚合段 */
  const activeSliceId = useMemo(() => {
    if (!hoverId || !report) return null;
    if (report.slices.some((slice) => slice.id === hoverId)) return hoverId;
    for (const section of report.sections) {
      if (
        isGroupSection(section.id) &&
        section.entries.some(
          (entry) => entry.id === hoverId || entry.children.some((child) => child.id === hoverId),
        )
      ) {
        return groupSliceId(section.id);
      }
    }
    return hoverId;
  }, [hoverId, report]);

  const activeSlice =
    activeSliceId && !isEmpty ? chartData.find((slice) => slice.id === activeSliceId) ?? null : null;

  /** 悬停明细行（含子资源行）时的行级读数（比聚合段更具体） */
  const hoveredEntry = useMemo(() => {
    if (!hoverId || !report) return null;
    for (const section of report.sections) {
      for (const entry of section.entries) {
        if (entry.id === hoverId) return entry;
        const child = entry.children.find((item) => item.id === hoverId);
        if (child) return child;
      }
    }
    return null;
  }, [hoverId, report]);

  const readout = hoveredEntry
    ? {
        color: sliceColor(hoveredEntry.tone, hoveredEntry.colorIndex),
        icon: entryIcon(hoveredEntry),
        label: hoveredEntry.label,
        bytes: hoveredEntry.bytes,
      }
    : activeSlice
      ? {
          color: sliceColor(activeSlice.tone, activeSlice.colorIndex),
          icon: sliceIcon(activeSlice),
          label: activeSlice.label,
          bytes: activeSlice.bytes,
        }
      : null;

  const metaText = scanning
    ? report
      ? "正在重新统计…"
      : "正在统计存储占用…"
    : report
      ? `上次统计 ${new Date(report.scannedAt).toLocaleTimeString()} · ${report.scannedFiles.toLocaleString()} 个文件${report.skipped > 0 ? ` · 跳过 ${report.skipped} 项` : ""}`
      : "尚未统计";

  const progressTotal = progress?.total ?? 0;
  const progressPct =
    progressTotal > 0 ? Math.max(4, Math.round(((progress?.current ?? 0) / progressTotal) * 100)) : 0;

  return (
    <div>
      <PageHeader title="存储" desc="查看启动器与游戏数据的磁盘占用分布" />

      {/* 顶部：上次统计信息 + 重新统计 */}
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="min-w-0 truncate text-[12px] text-muted-foreground">{metaText}</div>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0"
          onClick={() => void runScan()}
          disabled={scanning}
          aria-label="重新统计存储占用"
        >
          <RotateCw className={cn("size-3.5", scanning && "animate-spin")} />
          重新统计
        </Button>
      </div>

      {/* 统计失败提示（有旧数据时保留展示，仅追加横幅） */}
      {error && (
        <SettingCard className="mb-5 border-destructive/30">
          <div className="flex items-center gap-2 text-[13px] text-destructive">
            <AlertTriangle className="size-4 shrink-0" />
            <span className="min-w-0 break-all">统计失败：{error}</span>
          </div>
        </SettingCard>
      )}

      {/* 扫描进度 */}
      {scanning && (
        <SettingCard className="mb-5">
          <div className="flex items-center gap-3">
            <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium text-foreground">
                {progress?.label ?? "正在准备统计…"}
              </div>
              <div className="text-[11px] text-muted-foreground tabular-nums">
                {progress
                  ? [
                      progressTotal > 0 ? `任务 ${progress.current}/${progress.total}` : null,
                      `${formatBytes(progress.scannedBytes)} · ${progress.scannedFiles.toLocaleString()} 个文件`,
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : "正在准备统计…"}
              </div>
            </div>
          </div>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full bg-primary/80 transition-all duration-200", progressTotal === 0 && "animate-pulse")}
              style={{ width: progressTotal > 0 ? `${progressPct}%` : "15%" }}
            />
          </div>
        </SettingCard>
      )}

      {/* 顶部：占用分布长条（苹果存储页风格——一整条横向长条显示各类别占比，明细在下方）
          页面整体照常滚动，这一块碰到滚动顶部后吸附停住（磨砂卡片遮住从下方滚过的明细） */}
      <SettingCard
        className={cn(
          "sticky top-0 z-20 mb-7 transition-opacity",
          scanning && report && "opacity-60",
        )}
      >
        {/* 长条上方读数：悬停某个类别 → 该类别详情；否则总占用 */}
        <div className="mb-2.5 flex items-end justify-between gap-3">
          <div className="min-w-0">
            {readout ? (
              <>
                <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                  <span
                    className="flex size-4 shrink-0 items-center justify-center rounded"
                    style={{ backgroundColor: `${readout.color}1f`, color: readout.color }}
                  >
                    <readout.icon className="size-2.5" />
                  </span>
                  <span className="truncate">{readout.label}</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-bold text-foreground tabular-nums">
                    {formatBytes(readout.bytes)}
                  </span>
                  <span className="text-[12px] text-muted-foreground tabular-nums">
                    {formatPercent(readout.bytes, report?.totalBytes ?? 0)}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="text-[12px] text-muted-foreground">总占用</div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-bold text-foreground tabular-nums">
                    {formatBytes(report?.totalBytes ?? 0)}
                  </span>
                  <span className="text-[12px] text-muted-foreground tabular-nums">
                    {report ? `${report.scannedFiles.toLocaleString()} 个文件` : "统计中…"}
                  </span>
                </div>
              </>
            )}
          </div>
          <div className="shrink-0 text-right text-[11px] text-muted-foreground tabular-nums">
            {!report ? "统计中…" : isEmpty ? "暂无数据" : `${chartData.length} 个类别`}
          </div>
        </div>

        {/* 分段比例长条：长方形（仅 3px 小圆角、不用胶囊圆角），每段宽度 = 该类别占比 */}
        <div
          className="flex h-3 w-full overflow-hidden rounded-[3px] bg-muted"
          style={
            isEmpty
              ? undefined
              : {
                  animation: "storage-bar-in 560ms cubic-bezier(0.22,1,0.36,1) both",
                  transformOrigin: "left center",
                }
          }
        >
          {chartData.map((slice) => {
            const active = activeSliceId === slice.id;
            return (
              <div
                key={slice.id}
                className={cn(
                  "h-full shrink-0 transition-all duration-300 ease-out",
                  isEmpty ? "bg-muted-foreground/20" : "cursor-pointer",
                  !isEmpty && activeSliceId !== null && !active && "opacity-35",
                )}
                style={{
                  width: `${(slice.bytes / barTotal) * 100}%`,
                  backgroundColor: isEmpty ? undefined : sliceColor(slice.tone, slice.colorIndex),
                }}
                onMouseEnter={isEmpty ? undefined : () => setHoverId(slice.id)}
                onMouseLeave={isEmpty ? undefined : () => setHoverId(null)}
                title={
                  isEmpty
                    ? undefined
                    : `${slice.label} · ${formatBytes(slice.bytes)} · ${formatPercent(slice.bytes, report?.totalBytes ?? 0)}`
                }
              />
            );
          })}
        </div>
      </SettingCard>

      {/* 下方：分类明细（单栏，长条与明细行悬停双向联动） */}
      <div
        className={cn(
          "space-y-6 transition-opacity",
          scanning && report && "pointer-events-none opacity-50",
        )}
      >
        {report?.sections.map((section) => {
          const SectionIcon = SECTION_ICONS[section.id] ?? FolderOpen;
          return (
            <section key={section.id}>
              <SectionTitle icon={<SectionIcon className="size-3.5" />}>{section.title}</SectionTitle>
              {section.entries.length > 0 ? (
                <SettingCard className="overflow-hidden px-0 py-0">
                  <div className="divide-y divide-border/40">
                    {section.entries.map((entry) => (
                      <EntryRow
                        key={entry.id}
                        entry={entry}
                        sectionSliceId={isGroupSection(section.id) ? groupSliceId(section.id) : undefined}
                        showOpen={!isGroupSection(section.id)}
                        total={report.totalBytes}
                        hoveredId={hoverId}
                        onHover={setHoverId}
                        onOpen={openFolder}
                      />
                    ))}
                  </div>
                </SettingCard>
              ) : (
                <div className="px-1 py-2 text-[12px] text-muted-foreground">该分类下没有需要单独统计的数据</div>
              )}
            </section>
          );
        })}

        {/* 统计提示（目录嵌套 / 已合并等去重说明） */}
        {report && report.warnings.length > 0 && (
          <section>
            <SectionTitle>统计提示</SectionTitle>
            <SettingCard>
              <ul className="space-y-1.5">
                {report.warnings.map((w, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-[12px] text-amber-600 dark:text-amber-400"
                  >
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                    <span className="min-w-0">{w}</span>
                  </li>
                ))}
              </ul>
            </SettingCard>
          </section>
        )}

        {report && (
          <div className="min-w-0 truncate px-1 text-[11px] text-muted-foreground">
            统计耗时 {(report.durationMs / 1000).toFixed(1)} 秒 · 数据目录 {report.userDataPath}
          </div>
        )}
      </div>
    </div>
  );
}
