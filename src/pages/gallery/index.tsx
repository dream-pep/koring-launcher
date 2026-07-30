import { useEffect, useState, useCallback } from "react";
import { Button } from "@heroui/react";
import { Plus, Gamepad2, RefreshCw } from "lucide-react";
import { useInstanceStore } from "@/stores/instanceStore";
import { useConfigStore } from "@/stores/configStore";
import { Skeleton } from "@/components/ui/skeleton";
import { Surface } from "@/components/setting/Surface";
import { InstanceCard } from "./InstanceCard";
import { CreateDialog } from "./CreateDialog";
import type { InstanceRuntime } from "@/api/instance";

export function Gallery() {
  const { instances, loading, fetchInstances, create, launch } = useInstanceStore();
  const gameConfig = useConfigStore((s) => s.config.game);
  const configInstances = useConfigStore((s) => s.config.instances);
  const setInstances = useConfigStore((s) => s.setInstances);

  const [createOpen, setCreateOpen] = useState(false);
  const [launching, setLaunching] = useState<string | null>(null);

  const loadInstances = useCallback(async () => {
    await fetchInstances(gameConfig.gameDir);
  }, [fetchInstances, gameConfig.gameDir]);

  useEffect(() => {
    loadInstances();
  }, [loadInstances]);

  const handleCreate = async (name: string, runtime: InstanceRuntime, displayName?: string) => {
    await create(name, gameConfig.gameDir, runtime, {
      description: displayName,
    });

    // Sync to Koring.yml
    const loader = runtime.forge ? "forge"
      : runtime.fabricLoader ? "fabric"
      : runtime.quiltLoader ? "quilt"
      : runtime.neoForged ? "neoforged"
      : "vanilla";

    const loaderVersion = runtime.forge || runtime.fabricLoader || runtime.quiltLoader || runtime.neoForged || "";

    const updated = configInstances.filter((m) => m.name !== name);
    updated.push({
      name,
      displayName: displayName || name,
      icon: "",
      gameVersion: runtime.minecraft,
      loader,
      loaderVersion,
      createdAt: Date.now(),
      lastPlayed: 0,
      playtime: 0,
    });
    setInstances(updated);
    setCreateOpen(false);
  };

  const handlePlay = async (name: string) => {
    setLaunching(name);
    try {
      await launch(name, gameConfig.gameDir);
    } catch {
      // Launch events handled via IPC listeners
    }
    // Update lastPlayed in config
    const idx = configInstances.findIndex((m) => m.name === name);
    if (idx >= 0) {
      const updated = [...configInstances];
      updated[idx] = { ...updated[idx], lastPlayed: Date.now() };
      setInstances(updated);
    }
    setLaunching(null);
  };

  const handleSettings = (name: string) => {
    // TODO: Navigate to instance settings
    console.log("Settings for:", name);
  };

  const getDisplayName = (name: string) => {
    return configInstances.find((m) => m.name === name)?.displayName;
  };

  return (
    <div className="p-6 h-full overflow-y-auto scroll-area">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">实例管理</h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            创建、管理和启动 Minecraft 实例
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="light" onPress={loadInstances} isDisabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button size="sm" startContent={<Plus className="w-4 h-4" />} onPress={() => setCreateOpen(true)}>
            新建实例
          </Button>
        </div>
      </div>

      {/* 加载骨架 */}
      {loading && instances.length === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Surface key={i} padding="md">
              <div className="space-y-3">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-14 rounded-md" />
                  <Skeleton className="h-5 w-20 rounded-md" />
                </div>
                <Skeleton className="h-8 w-full rounded-lg" />
              </div>
            </Surface>
          ))}
        </div>
      )}

      {/* 空状态 */}
      {!loading && instances.length === 0 && (
        <Surface variant="flat" padding="lg">
          <div className="flex flex-col items-center gap-4 py-16">
            <div className="w-16 h-16 rounded-full bg-foreground/[0.04] dark:bg-white/[0.04] flex items-center justify-center">
              <Gamepad2 className="w-8 h-8 text-muted-foreground/30" />
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">还没有任何实例</p>
              <p className="text-[12px] text-muted-foreground/60 mt-1 max-w-[300px]">
                点击"新建实例"创建你的第一个 Minecraft 游戏实例
              </p>
            </div>
            <Button size="sm" startContent={<Plus className="w-4 h-4" />} onPress={() => setCreateOpen(true)}>
              新建实例
            </Button>
          </div>
        </Surface>
      )}

      {/* 实例网格 */}
      {instances.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {instances.map((inst) => (
            <InstanceCard
              key={inst.name}
              instance={inst}
              displayName={getDisplayName(inst.name)}
              onPlay={handlePlay}
              onSettings={handleSettings}
              isLaunching={launching === inst.name}
            />
          ))}
        </div>
      )}

      <CreateDialog
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={handleCreate}
      />
    </div>
  );
}
