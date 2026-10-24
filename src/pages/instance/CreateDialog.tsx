import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@heroui/react";
import { AlertCircle, ChevronLeft, ChevronRight, Loader2, Plus, X } from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";
import {
  checkInstanceName,
  createInstance,
  getInstallLocations,
  getLoaderCatalog,
  getMinecraftVersionList,
  installInstance,
  type InstanceNameCheck,
  type InstallLocation,
  type LoaderOption,
  type LoaderType,
} from "@/api/instance";
import { fieldCls } from "@/components/setting";

interface CreateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** 创建成功（可选是否已触发安装） */
  onCreated: (name: string, installing: boolean) => void;
}

/** 加载器 → 写入 instance.json 的 runtime 字段 */
const LOADER_FIELD: Record<Exclude<LoaderType, "none">, "forge" | "neoForged" | "fabricLoader" | "quiltLoader"> = {
  forge: "forge",
  neoforged: "neoForged",
  fabric: "fabricLoader",
  quilt: "quiltLoader",
};

const STEPS = ["基本信息", "版本与加载器", "内存与确认"];

type VersionFilter = "release" | "snapshot";

export function CreateDialog({ isOpen, onClose, onCreated }: CreateDialogProps) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [location, setLocation] = useState("");
  const [locations, setLocations] = useState<InstallLocation[]>([]);
  const [nameCheck, setNameCheck] = useState<InstanceNameCheck | null>(null);
  const [checkingName, setCheckingName] = useState(false);

  const [mcVersions, setMcVersions] = useState<string[]>([]);
  const [versionFilter, setVersionFilter] = useState<VersionFilter>("release");
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [mcVersion, setMcVersion] = useState("");

  const [loaders, setLoaders] = useState<LoaderOption[]>([]);
  const [loadingLoaders, setLoadingLoaders] = useState(false);
  const [loaderType, setLoaderType] = useState<LoaderType>("none");
  const [loaderVersion, setLoaderVersion] = useState("");

  const [memory, setMemory] = useState(4);
  const [autoInstall, setAutoInstall] = useState(true);

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const checkTimer = useRef<number | null>(null);

  // 打开时初始化：安装位置 + 版本列表
  useEffect(() => {
    if (!isOpen) return;
    setStep(0);
    setName("");
    setDisplayName("");
    setNameCheck(null);
    setError("");
    setCreating(false);
    setLoaderType("none");
    setLoaderVersion("");
    setMemory(4);
    setAutoInstall(true);

    void (async () => {
      try {
        const list = await getInstallLocations();
        setLocations(list);
        const preferred = list.find((item) => item.isDefault && item.exists && item.writable) ?? list.find((item) => item.exists && item.writable);
        setLocation(preferred?.resolvedPath ?? "");
      } catch {
        setLocations([]);
      }
    })();

    setLoadingVersions(true);
    void (async () => {
      try {
        const result = await getMinecraftVersionList();
        const releases = result.versions.filter((item) => item.type === "release").map((item) => item.id);
        setMcVersions(releases);
        setMcVersion((previous) => previous || releases[0] || "");
      } catch {
        setMcVersions([]);
      } finally {
        setLoadingVersions(false);
      }
    })();
  }, [isOpen]);

  // 名称校验（防抖 350ms）
  useEffect(() => {
    if (!isOpen) return;
    if (checkTimer.current) window.clearTimeout(checkTimer.current);
    const trimmed = name.trim();
    if (!trimmed || !location) {
      setNameCheck(null);
      return;
    }
    setCheckingName(true);
    checkTimer.current = window.setTimeout(() => {
      void checkInstanceName(trimmed, location)
        .then((result) => setNameCheck(result))
        .catch(() => setNameCheck(null))
        .finally(() => setCheckingName(false));
    }, 350);
    return () => {
      if (checkTimer.current) window.clearTimeout(checkTimer.current);
    };
  }, [name, location, isOpen]);

  // MC 版本切换 → 拉加载器目录
  useEffect(() => {
    if (!isOpen || !mcVersion) return;
    let cancelled = false;
    setLoadingLoaders(true);
    void (async () => {
      try {
        const catalog = await getLoaderCatalog(mcVersion);
        if (cancelled) return;
        setLoaders(catalog);
        const current = catalog.find((item) => item.type === loaderType);
        setLoaderVersion(current?.latest ?? "");
      } catch {
        if (!cancelled) setLoaders([]);
      } finally {
        if (!cancelled) setLoadingLoaders(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // loaderType 变化时不重新拉目录，只由下面的 effect 校正默认版本
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, mcVersion]);

  // 切换加载器类型 → 默认选中最新版本
  useEffect(() => {
    const current = loaders.find((item) => item.type === loaderType);
    setLoaderVersion(current?.latest ?? "");
  }, [loaderType, loaders]);

  const selectedLoader = useMemo(() => loaders.find((item) => item.type === loaderType), [loaders, loaderType]);

  const versionsForDisplay = useMemo(() => {
    // 版本列表按类型过滤（release 以外的都归为快照/旧版）
    if (versionFilter === "release") return mcVersions.slice(0, 36);
    return mcVersions.slice(36, 72);
  }, [mcVersions, versionFilter]);

  const nameProblem = nameCheck && !nameCheck.available ? nameCheck.reason : "";
  const canNext =
    step === 0
      ? Boolean(name.trim() && location && !nameProblem && !checkingName)
      : step === 1
        ? Boolean(mcVersion) && (loaderType === "none" || Boolean(loaderVersion))
        : true;

  const handleCreate = useCallback(async () => {
    setCreating(true);
    setError("");
    try {
      const runtime = { minecraft: mcVersion } as Record<string, string> & { minecraft: string };
      if (loaderType !== "none" && loaderVersion) {
        runtime[LOADER_FIELD[loaderType]] = loaderVersion;
      }
      const instance = await createInstance(name.trim(), location, runtime, {
        description: displayName.trim() || undefined,
        minMemory: Math.min(2, memory),
        maxMemory: memory,
      });
      if (autoInstall) {
        await installInstance(instance.name, location);
      }
      onCreated(instance.name, autoInstall);
      toast.success(`实例「${displayName.trim() || instance.name}」已创建`, {
        description: autoInstall ? "正在后台下载游戏文件，可在任务队列查看进度" : "还没有游戏文件，可在实例详情里点「修复」下载",
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  }, [autoInstall, displayName, loaderType, loaderVersion, location, mcVersion, memory, name, onClose, onCreated]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={creating ? undefined : onClose} />
      <div className="relative z-10 mx-4 w-full max-w-2xl overflow-hidden rounded-2xl border border-border/50 bg-background shadow-2xl dark:border-white/[0.08]">
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-border/30 px-6 py-4 dark:border-white/[0.04]">
          <div className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold text-foreground">新建实例</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={creating}
            className="rounded-md p-1 transition-colors hover:bg-foreground/[0.06] disabled:opacity-40"
            aria-label="关闭"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* 步骤条 */}
        <div className="flex items-center gap-2 px-6 pt-5">
          {STEPS.map((label, index) => (
            <div key={label} className="flex items-center gap-2">
              <div
                className={clsx(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-colors",
                  index === step
                    ? "bg-primary text-primary-foreground"
                    : index < step
                      ? "bg-primary/20 text-primary"
                      : "bg-foreground/[0.06] text-muted-foreground dark:bg-white/[0.06]"
                )}
              >
                {index < step ? "✓" : index + 1}
              </div>
              <span className={clsx("text-[12px]", index === step ? "font-medium text-foreground" : "text-muted-foreground")}>
                {label}
              </span>
              {index < STEPS.length - 1 && <div className="h-px w-5 bg-border/40" />}
            </div>
          ))}
        </div>

        {/* 内容 */}
        <div className="scroll-area max-h-[56vh] space-y-4 overflow-y-auto px-6 py-5">
          {step === 0 && (
            <>
              <div className="space-y-1.5">
                <p className="text-[12px] font-medium text-muted-foreground">实例 ID（目录名，仅英文/数字/连字符）</p>
                <input
                  className={clsx(fieldCls, "h-9 w-full px-3")}
                  placeholder="例如: survival-1-21"
                  value={name}
                  autoFocus
                  onChange={(event) => setName(event.target.value)}
                />
                {checkingName && <p className="text-[11px] text-muted-foreground">正在校验名称…</p>}
                {!checkingName && nameProblem && (
                  <p className="flex items-center gap-1 text-[11px] text-destructive">
                    <AlertCircle className="h-3 w-3" />
                    {nameProblem}
                  </p>
                )}
                {!checkingName && nameCheck?.available && (
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400">名称可用</p>
                )}
                {nameCheck && nameCheck.conflicts.length > 0 && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400">
                    已存在同名目录：{nameCheck.conflicts.join("、")}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <p className="text-[12px] font-medium text-muted-foreground">显示名称（可选）</p>
                <input
                  className={clsx(fieldCls, "h-9 w-full px-3")}
                  placeholder="例如: 生存世界"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <p className="text-[12px] font-medium text-muted-foreground">安装位置</p>
                <div className="space-y-1">
                  {locations.length === 0 && <p className="text-[12px] text-muted-foreground">未找到可用的游戏目录</p>}
                  {locations.map((item) => (
                    <button
                      key={item.resolvedPath}
                      type="button"
                      disabled={!item.writable || !item.exists}
                      onClick={() => setLocation(item.resolvedPath)}
                      className={clsx(
                        "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-[12px] transition-colors",
                        location === item.resolvedPath
                          ? "border-primary/40 bg-primary/10 text-foreground"
                          : "border-border/40 text-muted-foreground hover:text-foreground dark:border-white/[0.08]",
                        (!item.writable || !item.exists) && "cursor-not-allowed opacity-50"
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{item.label}</span>
                        <span className="block truncate text-[11px] text-muted-foreground/70">{item.resolvedPath}</span>
                      </span>
                      <span className="shrink-0 text-[11px] text-muted-foreground/70">{item.instanceCount} 个实例</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[12px] font-medium text-muted-foreground">Minecraft 版本</p>
                  <div className="flex items-center gap-1">
                    {(["release", "snapshot"] as VersionFilter[]).map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setVersionFilter(item)}
                        className={clsx(
                          "rounded-md px-2 py-0.5 text-[11px] transition-colors",
                          versionFilter === item ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {item === "release" ? "正式版" : "快照/旧版"}
                      </button>
                    ))}
                  </div>
                </div>
                {loadingVersions ? (
                  <div className="flex items-center gap-2 py-4 text-[12px] text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    正在拉取版本列表…
                  </div>
                ) : versionsForDisplay.length === 0 ? (
                  <p className="py-3 text-[12px] text-muted-foreground">没有可用版本（请检查网络或下载源设置）</p>
                ) : (
                  <div className="grid grid-cols-4 gap-1.5">
                    {versionsForDisplay.map((version) => (
                      <button
                        key={version}
                        type="button"
                        onClick={() => setMcVersion(version)}
                        className={clsx(
                          "rounded-lg border px-2 py-1.5 text-[12px] transition-colors",
                          mcVersion === version
                            ? "border-primary bg-primary/10 font-medium text-primary"
                            : "border-border/40 text-muted-foreground hover:border-primary/30 hover:text-foreground dark:border-white/[0.06]"
                        )}
                      >
                        {version}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-[12px] font-medium text-muted-foreground">模组加载器</p>
                {loadingLoaders ? (
                  <div className="flex items-center gap-2 py-2 text-[12px] text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    正在拉取加载器版本…
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-1.5">
                    {loaders.map((option) => (
                      <button
                        key={option.type}
                        type="button"
                        onClick={() => setLoaderType(option.type)}
                        className={clsx(
                          "rounded-lg border px-3 py-2 text-left transition-colors",
                          loaderType === option.type
                            ? "border-primary/40 bg-primary/10"
                            : "border-border/40 hover:border-primary/30 dark:border-white/[0.06]"
                        )}
                      >
                        <span className="block text-[12px] font-medium text-foreground">{option.label}</span>
                        <span className="block truncate text-[11px] text-muted-foreground/70">
                          {option.versions.length > 0 ? `${option.versions.length} 个版本` : option.note ?? "不可用"}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {loaderType !== "none" && selectedLoader && selectedLoader.versions.length > 0 && (
                  <select
                    className={clsx(fieldCls, "h-9 w-full px-2")}
                    value={loaderVersion}
                    onChange={(event) => setLoaderVersion(event.target.value)}
                  >
                    {selectedLoader.versions.slice(0, 80).map((version) => (
                      <option key={version} value={version}>
                        {version}
                        {version === selectedLoader.latest ? "（最新）" : ""}
                      </option>
                    ))}
                  </select>
                )}
                {loaderType !== "none" && selectedLoader && !selectedLoader.supported && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400">该加载器暂不支持自动安装，创建后需要手动补文件</p>
                )}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[12px] font-medium text-muted-foreground">最大内存</p>
                  <span className="text-[13px] font-semibold text-foreground">{memory} GB</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={32}
                  step={1}
                  value={memory}
                  onChange={(event) => setMemory(Number(event.target.value))}
                  className="w-full accent-primary"
                />
              </div>

              <label className="flex cursor-pointer items-center gap-2 text-[13px] text-foreground">
                <input type="checkbox" checked={autoInstall} onChange={(event) => setAutoInstall(event.target.checked)} className="accent-primary" />
                创建后立即下载游戏文件（推荐）
              </label>

              <div className="space-y-1 rounded-lg border border-border/30 bg-foreground/[0.03] p-3 dark:border-white/[0.04] dark:bg-white/[0.03]">
                <p className="text-[12px] font-medium text-foreground">创建摘要</p>
                <p className="text-[12px] text-muted-foreground">
                  名称：{displayName.trim() || name.trim()}（{name.trim()}）
                </p>
                <p className="text-[12px] text-muted-foreground">
                  版本：Minecraft {mcVersion}
                  {loaderType !== "none" && selectedLoader ? ` · ${selectedLoader.label} ${loaderVersion}` : " · 原版"}
                </p>
                <p className="text-[12px] text-muted-foreground">内存：最大 {memory} GB</p>
                <p className="truncate text-[12px] text-muted-foreground">位置：{location}</p>
              </div>
            </>
          )}

          {error && (
            <p className="flex items-start gap-1 text-[12px] text-destructive">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {error}
            </p>
          )}
        </div>

        {/* 底部 */}
        <div className="flex items-center justify-between border-t border-border/30 px-6 py-4 dark:border-white/[0.04]">
          <div>
            {step > 0 && !creating && (
              <Button variant="ghost" size="sm" onPress={() => setStep(step - 1)}>
                <ChevronLeft className="h-4 w-4" />
                上一步
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onPress={onClose} isDisabled={creating}>
              取消
            </Button>
            {step < STEPS.length - 1 ? (
              <Button size="sm" onPress={() => setStep(step + 1)} isDisabled={!canNext}>
                下一步
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button size="sm" onPress={() => void handleCreate()} isDisabled={creating || !canNext}>
                {creating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {creating ? "创建中…" : "创建实例"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
