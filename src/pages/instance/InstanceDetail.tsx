import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Button } from "@heroui/react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Code2,
  FolderOpen,
  HardDrive,
  Image as ImageIcon,
  Loader2,
  Package,
  Pencil,
  RefreshCw,
  Save,
  ScrollText,
  Settings2,
  Star,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import clsx from "clsx";
import { toast } from "@/lib/toast";
import { directionFromIndex, runViewTransition } from "@/lib/view-transition";
import {
  diagnoseInstance,
  openPath,
  updateInstance,
  type InstanceConfig,
  type InstanceIconInfo,
  type InstanceInfo,
} from "@/api/instance";
import { fieldCls } from "@/components/setting";
import { InstanceIcon } from "./InstanceIcon";
import { ModsTab } from "./tabs/ModsTab";
import { SavesTab } from "./tabs/SavesTab";
import { ScreenshotsTab } from "./tabs/ScreenshotsTab";
import { ResourcePacksTab } from "./tabs/ResourcePacksTab";
import { LogsTab } from "./tabs/LogsTab";

type TabKey = "overview" | "settings" | "mods" | "saves" | "screenshots" | "resourcepacks" | "logs";

const TABS: { key: TabKey; label: string; icon: typeof HardDrive }[] = [
  { key: "overview", label: "概览", icon: HardDrive },
  { key: "settings", label: "设置", icon: Settings2 },
  { key: "mods", label: "模组", icon: Package },
  { key: "saves", label: "存档", icon: Save },
  { key: "screenshots", label: "截图", icon: ImageIcon },
  { key: "resourcepacks", label: "资源包", icon: Code2 },
  { key: "logs", label: "日志", icon: ScrollText },
];

/** 页签空间顺序：切换方向跟随页签在顶部的左右排列 */
const TAB_ORDER = TABS.map((item) => item.key);

interface InstanceDetailProps {
  instance: InstanceInfo;
  icon?: InstanceIconInfo;
  gamePath: string;
  /** 是否为全局选中的版本（首页启动的那个） */
  selected: boolean;
  repairing: boolean;
  /** 选择该版本（不启动游戏） */
  onSelect: () => void;
  onRepair: () => void;
  onDelete: () => void;
  onChanged: () => void;
}

function formatDuration(ms?: number): string {
  const total = Math.max(0, Math.floor((ms || 0) / 60000));
  if (total < 1) return "不足 1 分钟";
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return hours > 0 ? `${hours} 小时 ${minutes} 分钟` : `${minutes} 分钟`;
}

function formatDate(timestamp?: number): string {
  if (!timestamp) return "—";
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** 概览中的一行信息 */
function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-3 py-1.5">
      <span className="w-24 shrink-0 text-[12px] text-muted-foreground">{label}</span>
      <span className={clsx("min-w-0 flex-1 break-all text-[12px] text-foreground", mono && "font-mono text-[11px]")}>
        {value}
      </span>
    </div>
  );
}

interface SettingsDraft {
  description: string;
  category: string;
  favorite: boolean;
  minMemory: number;
  maxMemory: number;
  java: string;
  launchVersion: string;
  serverHost: string;
  serverPort: string;
  showLog: boolean;
  hideLauncher: boolean;
  vmOptions: string;
  mcOptions: string;
}

function makeDraft(config: InstanceConfig): SettingsDraft {
  return {
    description: config.description ?? "",
    category: config.category ?? "",
    favorite: Boolean(config.favorite),
    minMemory: config.minMemory ?? 1,
    maxMemory: config.maxMemory ?? 4,
    java: config.java ?? "",
    launchVersion: config.launchVersion ?? "",
    serverHost: config.server?.host ?? "",
    serverPort: config.server?.port ? String(config.server.port) : "",
    showLog: Boolean(config.showLog),
    hideLauncher: Boolean(config.hideLauncher),
    vmOptions: (config.vmOptions ?? []).join("\n"),
    mcOptions: (config.mcOptions ?? []).join("\n"),
  };
}

/** 设置页签：本地草稿 + 保存按钮，避免每敲一个字都落盘 */
function SettingsTab({
  instance,
  gamePath,
  onChanged,
}: {
  instance: InstanceInfo;
  gamePath: string;
  onChanged: () => void;
}) {
  const [draft, setDraft] = useState<SettingsDraft>(() => makeDraft(instance.config));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(makeDraft(instance.config));
  }, [instance.config]);

  const set = <K extends keyof SettingsDraft>(key: K, value: SettingsDraft[K]) =>
    setDraft((previous) => ({ ...previous, [key]: value }));

  const save = async () => {
    if (draft.maxMemory < draft.minMemory) {
      toast.error("最大内存不能小于最小内存");
      return;
    }
    const port = draft.serverPort.trim() ? Number(draft.serverPort.trim()) : undefined;
    if (port !== undefined && (!Number.isInteger(port) || port <= 0 || port > 65535)) {
      toast.error("服务器端口不合法");
      return;
    }
    setSaving(true);
    try {
      await updateInstance(instance.name, gamePath, {
        description: draft.description.trim() || undefined,
        category: draft.category.trim() || undefined,
        favorite: draft.favorite,
        minMemory: draft.minMemory,
        maxMemory: draft.maxMemory,
        java: draft.java.trim() || undefined,
        launchVersion: draft.launchVersion.trim() || undefined,
        server: draft.serverHost.trim()
          ? { host: draft.serverHost.trim(), port }
          : undefined,
        showLog: draft.showLog,
        hideLauncher: draft.hideLauncher,
        vmOptions: draft.vmOptions.split("\n").map((line) => line.trim()).filter(Boolean),
        mcOptions: draft.mcOptions.split("\n").map((line) => line.trim()).filter(Boolean),
      });
      toast.success("实例设置已保存");
      onChanged();
    } catch (e) {
      toast.error(`保存失败：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  };

  const textInput = (key: keyof SettingsDraft, placeholder: string, mono = false) => (
    <input
      className={clsx(fieldCls, "h-8 w-full px-2", mono && "font-mono text-[11px]")}
      value={String(draft[key])}
      placeholder={placeholder}
      onChange={(event) => set(key, event.target.value as never)}
    />
  );

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-border/40 p-4 dark:border-white/[0.08]">
        <h3 className="mb-3 text-[13px] font-semibold text-foreground">基本信息</h3>
        <div className="space-y-2">
          <div>
            <p className="mb-1 text-[12px] text-muted-foreground">显示名称</p>
            {textInput("description", "不填则显示实例 ID")}
          </div>
          <div>
            <p className="mb-1 text-[12px] text-muted-foreground">分类</p>
            {textInput("category", "例如：生存 / 科技 / 整合包")}
          </div>
          <label className="flex cursor-pointer items-center gap-2 pt-1 text-[13px] text-foreground">
            <input
              type="checkbox"
              className="accent-primary"
              checked={draft.favorite}
              onChange={(event) => set("favorite", event.target.checked)}
            />
            收藏此实例
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-border/40 p-4 dark:border-white/[0.08]">
        <h3 className="mb-3 text-[13px] font-semibold text-foreground">内存与 Java</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="mb-1 text-[12px] text-muted-foreground">最小内存（GB）</p>
            <input
              type="number"
              min={1}
              max={64}
              className={clsx(fieldCls, "h-8 w-full px-2")}
              value={draft.minMemory}
              onChange={(event) => set("minMemory", Number(event.target.value) || 1)}
            />
          </div>
          <div>
            <p className="mb-1 text-[12px] text-muted-foreground">最大内存（GB）</p>
            <input
              type="number"
              min={1}
              max={64}
              className={clsx(fieldCls, "h-8 w-full px-2")}
              value={draft.maxMemory}
              onChange={(event) => set("maxMemory", Number(event.target.value) || 4)}
            />
          </div>
        </div>
        <div className="mt-3">
          <p className="mb-1 text-[12px] text-muted-foreground">Java 路径（留空 = 自动选择）</p>
          {textInput("java", "C:\\Program Files\\Java\\bin\\javaw.exe", true)}
        </div>
      </section>

      <section className="rounded-xl border border-border/40 p-4 dark:border-white/[0.08]">
        <h3 className="mb-3 text-[13px] font-semibold text-foreground">启动</h3>
        <div className="space-y-2">
          <div>
            <p className="mb-1 text-[12px] text-muted-foreground">启动版本（留空 = 按加载器自动推导）</p>
            {textInput("launchVersion", instance.launch.versionId, true)}
          </div>
          <div className="grid grid-cols-[1fr_120px] gap-2">
            <div>
              <p className="mb-1 text-[12px] text-muted-foreground">自动进入服务器（可选）</p>
              {textInput("serverHost", "play.example.com", true)}
            </div>
            <div>
              <p className="mb-1 text-[12px] text-muted-foreground">端口</p>
              {textInput("serverPort", "25565", true)}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 pt-1">
            <label className="flex cursor-pointer items-center gap-2 text-[13px] text-foreground">
              <input type="checkbox" className="accent-primary" checked={draft.showLog} onChange={(event) => set("showLog", event.target.checked)} />
              启动时显示日志窗口
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-[13px] text-foreground">
              <input type="checkbox" className="accent-primary" checked={draft.hideLauncher} onChange={(event) => set("hideLauncher", event.target.checked)} />
              启动后隐藏启动器
            </label>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border/40 p-4 dark:border-white/[0.08]">
        <h3 className="mb-3 text-[13px] font-semibold text-foreground">高级参数（每行一条）</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <p className="mb-1 text-[12px] text-muted-foreground">JVM 参数</p>
            <textarea
              className={clsx(fieldCls, "h-24 w-full resize-none px-2 py-1.5 font-mono text-[11px]")}
              value={draft.vmOptions}
              placeholder="-XX:+UseG1GC"
              onChange={(event) => set("vmOptions", event.target.value)}
            />
          </div>
          <div>
            <p className="mb-1 text-[12px] text-muted-foreground">游戏参数</p>
            <textarea
              className={clsx(fieldCls, "h-24 w-full resize-none px-2 py-1.5 font-mono text-[11px]")}
              value={draft.mcOptions}
              placeholder="--width 1280 --height 720"
              onChange={(event) => set("mcOptions", event.target.value)}
            />
          </div>
        </div>
      </section>

      <div className="flex items-center justify-end gap-2">
        <Button
          size="sm"
          variant="ghost"
          onPress={() =>
            setDraft({
              description: "",
              category: "",
              favorite: false,
              minMemory: 1,
              maxMemory: 4,
              java: "",
              launchVersion: "",
              serverHost: "",
              serverPort: "",
              showLog: false,
              hideLauncher: false,
              vmOptions: "",
              mcOptions: "",
            })
          }
          isDisabled={saving}
        >
          恢复默认
        </Button>
        <Button size="sm" variant="ghost" onPress={() => setDraft(makeDraft(instance.config))} isDisabled={saving}>
          重置
        </Button>
        <Button size="sm" onPress={() => void save()} isDisabled={saving}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          保存设置
        </Button>
      </div>
    </div>
  );
}

export function InstanceDetail({
  instance,
  icon,
  gamePath,
  selected,
  repairing,
  onSelect,
  onRepair,
  onDelete,
  onChanged,
}: InstanceDetailProps) {
  const [tab, setTab] = useState<TabKey>("overview");
  const tabContentRef = useRef<HTMLDivElement | null>(null);
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagnosis, setDiagnosis] = useState<{ healthy: boolean; issues: string[] } | null>(null);
  /** 头部显示名内联编辑（本地草稿 + 保存按钮，避免每敲一个字都落盘） */
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);

  const config = instance.config;
  const displayName = config.description || instance.name;

  // 页签切换：方向跟随页签左右顺序，旧内容先渐出、新内容再渐入（View Transition）
  const switchTab = (next: TabKey) => {
    if (next === tab) return;
    const direction = directionFromIndex(TAB_ORDER.indexOf(tab), TAB_ORDER.indexOf(next));
    runViewTransition(
      direction,
      () => {
        flushSync(() => setTab(next));
      },
      { element: tabContentRef.current, name: "instance-tab-content" },
    );
  };

  const issues = useMemo(() => {
    const list = [...(diagnosis?.issues ?? instance.issues)];
    if (instance.dependency.missingJar) list.push("缺少游戏主程序（client.jar）");
    if (instance.dependency.missingAssetIndex) list.push("缺少资源索引文件（assets）");
    if (instance.dependency.missingLibraries > 0) list.push(`缺少 ${instance.dependency.missingLibraries} 个依赖库`);
    if (instance.dependency.missingVersions.length > 0) {
      list.push(`缺少版本文件：${instance.dependency.missingVersions.join("、")}`);
    }
    return Array.from(new Set(list));
  }, [diagnosis, instance]);

  const runDiagnose = async () => {
    setDiagnosing(true);
    try {
      const result = await diagnoseInstance(instance.name, gamePath);
      setDiagnosis({ healthy: result.healthy, issues: result.issues });
      if (result.healthy) toast.success("体检通过：文件完整");
      else toast.warning(`发现 ${result.issues.length} 个问题，可点「修复」补齐`);
    } catch (e) {
      toast.error(`体检失败：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setDiagnosing(false);
    }
  };

  const toggleFavorite = async () => {
    try {
      await updateInstance(instance.name, gamePath, { favorite: !config.favorite });
      onChanged();
    } catch (e) {
      toast.error(`切换收藏失败：${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const startRename = () => {
    setNameDraft(config.description ?? "");
    setRenaming(true);
  };

  const saveName = async () => {
    if (savingName) return;
    setSavingName(true);
    try {
      await updateInstance(instance.name, gamePath, { description: nameDraft.trim() || undefined });
      toast.success("名称已保存");
      setRenaming(false);
      onChanged();
    } catch (e) {
      toast.error(`保存名称失败：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSavingName(false);
    }
  };

  return (
    <div className="scroll-area flex h-full flex-col overflow-y-auto">
      {/* 头部 */}
      <div className="border-b border-border/30 px-6 py-5 dark:border-white/[0.05]">
        <div className="flex items-start gap-4">
          <InstanceIcon name={instance.name} icon={icon} className="h-14 w-14" iconClassName="h-1/2 w-1/2" />

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {renaming ? (
                <>
                  <input
                    autoFocus
                    value={nameDraft}
                    placeholder="显示名称（留空则显示实例 ID）"
                    onChange={(event) => setNameDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void saveName();
                      if (event.key === "Escape") setRenaming(false);
                    }}
                    className={clsx(fieldCls, "h-8 w-64 px-2 text-[14px] font-semibold")}
                  />
                  <Button
                    size="sm"
                    className="h-8 min-w-0 px-2"
                    onPress={() => void saveName()}
                    isDisabled={savingName}
                    aria-label="保存名称"
                  >
                    {savingName ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    保存
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 min-w-0 px-2"
                    onPress={() => setRenaming(false)}
                    isDisabled={savingName}
                    aria-label="取消重命名"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </>
              ) : (
                <>
                  <h2 className="truncate text-lg font-bold text-foreground">{displayName}</h2>
                  <button
                    type="button"
                    onClick={startRename}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-foreground/[0.06] hover:text-foreground dark:hover:bg-white/[0.08]"
                    aria-label="重命名"
                    title="重命名（保存后生效）"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
              {config.favorite && <Star className="h-4 w-4 shrink-0 fill-current text-amber-500" />}
              {config.category && (
                <span className="shrink-0 rounded-md bg-foreground/[0.06] px-1.5 py-0.5 text-[11px] text-muted-foreground dark:bg-white/[0.08]">
                  {config.category}
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted-foreground">
              <span>Minecraft {config.runtime.minecraft}</span>
              <span className="text-muted-foreground/30">·</span>
              <span>{instance.launch.loaderLabels.length > 0 ? instance.launch.loaderLabels.join(" + ") : "原版"}</span>
              <span className="text-muted-foreground/30">·</span>
              <span className="truncate font-mono text-[11px]">{instance.path}</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {selected ? (
                <Button size="sm" variant="ghost" isDisabled className="text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  当前选中版本
                </Button>
              ) : (
                <Button size="sm" onPress={onSelect}>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  选择该版本
                </Button>
              )}
              <Button size="sm" variant="ghost" onPress={onRepair} isDisabled={repairing}>
                {repairing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wrench className="h-3.5 w-3.5" />}
                修复
              </Button>
              <Button size="sm" variant="ghost" onPress={() => void runDiagnose()} isDisabled={diagnosing}>
                {diagnosing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                体检
              </Button>
              <Button size="sm" variant="ghost" onPress={() => void openPath(instance.path)}>
                <FolderOpen className="h-3.5 w-3.5" />
                打开目录
              </Button>
              <Button size="sm" variant="ghost" onPress={() => void toggleFavorite()}>
                <Star className={clsx("h-3.5 w-3.5", config.favorite && "fill-current text-amber-500")} />
                {config.favorite ? "取消收藏" : "收藏"}
              </Button>
              <Button size="sm" variant="ghost" onPress={onDelete} className="text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
                删除
              </Button>
            </div>
          </div>
        </div>

        {issues.length > 0 && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/[0.08] px-3 py-2">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
            <div className="min-w-0 text-[12px] text-amber-700 dark:text-amber-400">
              <p className="font-medium">启动文件不完整</p>
              <ul className="mt-0.5 space-y-0.5">
                {issues.map((issue) => (
                  <li key={issue}>· {issue}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* 页签 */}
      <div className="flex items-center gap-1 border-b border-border/30 px-4 dark:border-white/[0.05]">
        {TABS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => switchTab(item.key)}
              className={clsx(
                "flex items-center gap-1.5 border-b-2 px-3 py-2 text-[12px] transition-colors",
                tab === item.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </button>
          );
        })}
      </div>

      {/* 内容：页签切换走方向性渐出渐入（View Transition，见 switchTab） */}
      <div ref={tabContentRef} className="flex-1 px-6 py-5">
        <div key={tab}>
        {tab === "overview" && (
          <div className="space-y-4">
            <section className="rounded-xl border border-border/40 p-4 dark:border-white/[0.08]">
              <div className="flex items-center gap-2">
                {instance.dependency.ready && issues.length === 0 ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                )}
                <h3 className="text-[13px] font-semibold text-foreground">
                  {instance.dependency.ready && issues.length === 0 ? "文件完整，可以启动" : "文件不完整，建议先修复"}
                </h3>
                <span className="ml-auto text-[11px] text-muted-foreground/60">
                  已校验 {instance.dependency.checkedLibraries} 个依赖库
                </span>
              </div>
              <div className="mt-3 divide-y divide-border/20 dark:divide-white/[0.04]">
                <InfoRow label="启动版本" value={instance.launch.versionId} mono />
                <InfoRow label="加载器" value={instance.launch.loaderLabels.length > 0 ? instance.launch.loaderLabels.join(" + ") : "原版"} />
                <InfoRow
                  label="加载器版本"
                  value={
                    Object.entries(config.runtime)
                      .filter(([key, value]) => key !== "minecraft" && Boolean(value))
                      .map(([key, value]) => {
                        const label: Record<string, string> = {
                          forge: "Forge",
                          neoForged: "NeoForge",
                          fabricLoader: "Fabric",
                          quiltLoader: "Quilt",
                          optifine: "OptiFine",
                        };
                        return `${label[key] ?? key} ${value}`;
                      })
                      .join(" · ") || "—"
                  }
                  mono
                />
                <InfoRow label="游戏目录" value={instance.path} mono />
                <InfoRow label="资源根" value={`${instance.launch.resourceRoot}（${instance.launch.rootSource}）`} mono />
                <InfoRow label="游玩时长" value={formatDuration(config.playtime)} />
                <InfoRow label="最近游玩" value={formatDate(config.lastPlayedDate)} />
                <InfoRow label="创建时间" value={formatDate(config.creationDate)} />
              </div>
              {instance.launch.warnings.length > 0 && (
                <div className="mt-3 space-y-1 rounded-lg bg-amber-500/[0.06] px-3 py-2">
                  {instance.launch.warnings.map((warning) => (
                    <p key={warning} className="text-[11px] text-amber-700 dark:text-amber-400">
                      · {warning}
                    </p>
                  ))}
                </div>
              )}
            </section>

            <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                { label: "模组", value: instance.modCount, tab: "mods" as TabKey },
                { label: "存档", value: instance.saveCount, tab: "saves" as TabKey },
                { label: "截图", value: instance.screenshotCount, tab: "screenshots" as TabKey },
                { label: "资源包", value: instance.resourcePackCount, tab: "resourcepacks" as TabKey },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => switchTab(item.tab)}
                  className="rounded-xl border border-border/40 px-4 py-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/[0.04] dark:border-white/[0.08]"
                >
                  <p className="text-xl font-bold text-foreground">{item.value}</p>
                  <p className="text-[11px] text-muted-foreground">{item.label}</p>
                </button>
              ))}
            </section>
          </div>
        )}

        {tab === "settings" && <SettingsTab instance={instance} gamePath={gamePath} onChanged={onChanged} />}
        {tab === "mods" && <ModsTab instancePath={instance.path} onChanged={onChanged} />}
        {tab === "saves" && <SavesTab instancePath={instance.path} onChanged={onChanged} />}
        {tab === "screenshots" && <ScreenshotsTab instancePath={instance.path} onChanged={onChanged} />}
        {tab === "resourcepacks" && <ResourcePacksTab instancePath={instance.path} />}
        {tab === "logs" && <LogsTab instancePath={instance.path} />}
        </div>
      </div>
    </div>
  );
}
