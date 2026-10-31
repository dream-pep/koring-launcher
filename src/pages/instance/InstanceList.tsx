import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import {
  getMinecraftVersionList,
  listInstances,
  type InstanceInfo,
  type InstanceRuntime,
} from "@/api/instance";
import { versionTypeLabel } from "@/lib/version-type";
import { toast } from "@/lib/toast";
import { SettingListItem } from "@/components/setting/SettingListItem";
import { useConfigStore } from "@/stores/configStore";
import { useInstanceStore } from "@/stores/instanceStore";
import { useRouteStore } from "@/stores/routeStore";

/** 实例行图标（用户指定：草地方块） */
const GRASS_ICON = `${import.meta.env.BASE_URL}Blocks/Grass.png`;

/** 加载器识别顺序（一个实例理论上只有一个主线加载器，OptiFine 可叠加） */
const LOADERS: { key: Exclude<keyof InstanceRuntime, "minecraft">; label: string }[] = [
  { key: "fabricLoader", label: "Fabric" },
  { key: "quiltLoader", label: "Quilt" },
  { key: "forge", label: "Forge" },
  { key: "neoForged", label: "NeoForge" },
  { key: "optifine", label: "OptiFine" },
];

function loaderLabel(runtime: InstanceRuntime | undefined): string {
  if (!runtime) return "";
  return LOADERS.flatMap(({ key, label }) => {
    const version = runtime[key];
    return version ? [`${label} ${version}`] : [];
  }).join(" + ");
}

/** 版本清单只拉一次（所有目录的实例列表共用） */
let versionTypesPromise: Promise<Map<string, string>> | null = null;
function loadVersionTypes(): Promise<Map<string, string>> {
  if (!versionTypesPromise) {
    versionTypesPromise = getMinecraftVersionList()
      .then((result) => new Map(result.versions.map((v) => [v.id, v.type])))
      .catch(() => new Map<string, string>());
  }
  return versionTypesPromise;
}

interface InstanceListProps {
  gamePath: string;
}

/**
 * 某个游戏目录下的实例列表（内容区）。
 *
 * 一行一个实例：图标 = 草地方块，主标题 = 实例名称，
 * 副标题 = 版本类型 · 版本号 · 加载器与版本号。
 * 点击一行 = 把该实例设为「启动版本」并跳转首页。
 *
 * 数据用局部 state（listInstances）而不是全局 instanceStore：PageShell 会保活多个目录的
 * 内容页，全局单份 instances 在目录之间会互相覆盖。
 */
export function InstanceList({ gamePath }: InstanceListProps) {
  const [instances, setInstances] = useState<InstanceInfo[]>([]);
  const [versionTypes, setVersionTypes] = useState<Map<string, string> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingName, setPendingName] = useState<string | null>(null);

  const selectedInstance = useConfigStore((s) => s.config.game.selectedInstance);
  const setGame = useConfigStore((s) => s.setGame);
  const selectInstance = useInstanceStore((s) => s.select);
  const navigate = useRouteStore((s) => s.navigate);

  const refresh = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listInstances(gamePath)
      .then((list) => {
        if (cancelled) return;
        setInstances(list);
        setLoading(false);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setError(reason instanceof Error ? reason.message : String(reason));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [gamePath]);

  useEffect(() => refresh(), [refresh]);

  useEffect(() => {
    let cancelled = false;
    void loadVersionTypes().then((map) => {
      if (!cancelled) setVersionTypes(map);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSelect = useCallback(
    async (instance: InstanceInfo) => {
      if (pendingName) return;
      setPendingName(instance.name);
      try {
        // 先让 instanceStore 的 currentInstance 指向它（首页恢复启动版本时依赖这个）
        await selectInstance(instance.name, gamePath);
        // select 内部会吞掉异常（只写 store.error），这里显式校验一次，避免失败也提示成功
        const state = useInstanceStore.getState();
        if (state.currentInstance?.name !== instance.name) {
          throw new Error(state.error || "读取实例信息失败");
        }
        setGame({ selectedInstance: instance.name });
        // toast.success(`已将「${instance.config.name || instance.name}」设为启动版本`);
        navigate("home");
      } catch (reason: unknown) {
        toast.error("切换启动版本失败", {
          description: reason instanceof Error ? reason.message : String(reason),
        });
      } finally {
        setPendingName(null);
      }
    },
    [gamePath, navigate, pendingName, selectInstance, setGame],
  );

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className="flex items-center gap-3 rounded-lg border border-border/40 bg-foreground/[0.02] px-3 py-2.5 dark:border-white/[0.06]"
          >
            <div className="h-10 w-10 shrink-0 animate-pulse rounded-md bg-foreground/[0.06]" />
            <div className="flex flex-1 flex-col gap-1.5">
              <div className="h-3.5 w-40 animate-pulse rounded bg-foreground/[0.06]" />
              <div className="h-3 w-56 animate-pulse rounded bg-foreground/[0.04]" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/[0.04] p-4">
        <div className="flex items-center gap-2 text-[13px] text-red-500">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>读取实例列表失败：{error}</span>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="flex items-center gap-1.5 rounded-md bg-foreground/[0.06] px-2.5 py-1.5 text-[12px] text-foreground/70 transition-colors hover:bg-foreground/[0.1] hover:text-foreground"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          重试
        </button>
      </div>
    );
  }

  if (instances.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border/60 py-16 text-center">
        <span className="text-[13.5px] text-foreground/50">这个目录下还没有实例</span>
        <span className="text-[12px] text-foreground/30">去 资源 安装一个版本试试</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {instances.map((instance) => {
        const runtime = instance.config.runtime;
        const minecraft = runtime?.minecraft ?? "";
        const typeLabel = versionTypeLabel(versionTypes?.get(minecraft), minecraft);
        const loaders = loaderLabel(runtime);
        const subtitle = [typeLabel, minecraft, loaders].filter(Boolean).join(" · ");
        const name = instance.config.name || instance.name;
        const isSelected = selectedInstance === instance.name;
        const isPending = pendingName === instance.name;

        return (
          <SettingListItem
            key={instance.name}
            selected={isSelected}
            disabled={isPending}
            onClick={() => void handleSelect(instance)}
            className="group gap-3 py-2.5"
          >
            <img
              src={GRASS_ICON}
              alt=""
              className="h-10 w-10 shrink-0 rounded-md object-cover"
              style={{ imageRendering: "pixelated" }}
            />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[14px] font-medium text-foreground">{name}</span>
              {subtitle && (
                <span className="truncate text-[12px] text-muted-foreground/70">{subtitle}</span>
              )}
            </span>
            {isPending ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
            ) : isSelected ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
            ) : null}
          </SettingListItem>
        );
      })}
    </div>
  );
}
