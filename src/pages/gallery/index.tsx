//  __         __     __   __     ______     __  __     ______        __   __     ______     ______
// /\ \       /\ \   /\ "-.\ \   /\  ___\   /\ \/ /    /\  ___\      /\ "-.\ \   /\  ___\   /\__  _\
// \ \ \____  \ \ \  \ \ \-.  \  \ \ \__ \  \ \  _"-.  \ \  __\      \ \ \-.  \  \ \  __\   \/_/\ \/
//  \ \_____\  \ \_\  \ \_\\"\_\  \ \_____\  \ \_\ \_\  \ \_____\     \ \_\\"\_\  \ \_____\    \ \_\
//   \/_____/   \/_/   \/_/ \/_/   \/_____/   \/_/\/_/   \/_____/      \/_/ \/_/   \/_____/     \/_/
//
// 所有权利归Lingke Network (china)所有 | dream_pep拥有其艺术改变权力
// 未经允许的情况下删除此版权头可能会受到民事指控
// 请勿在未经Lingke Network (china)允许的范围内修改代码并分发

import { useCallback, useEffect, useState } from "react";
import { Button } from "@heroui/react";
import { Plus, RefreshCw, Gamepad2 } from "lucide-react";
import { toast } from "sonner";
import { useInstanceStore } from "@/stores/instanceStore";
import { useConfigStore } from "@/stores/configStore";
import { useAuthStore } from "@/stores/authStore";
import { useLaunchStore } from "@/stores/launchStore";
import { useConfirmDialogStore } from "@/stores/confirmDialogStore";
import { useRouteStore } from "@/stores/routeStore";
import { openPath } from "@/api/system";
import { InstanceList } from "./InstanceList";
import { InstanceDetail } from "./InstanceDetail";
import { EditDialog } from "./EditDialog";

export function Gallery() {
  const { instances, loading, fetchInstances, remove } = useInstanceStore();
  const gameConfig = useConfigStore((s) => s.config.game);
  const configInstances = useConfigStore((s) => s.config.instances);
  const setInstances = useConfigStore((s) => s.setInstances);
  const user = useAuthStore((s) => s.user);
  const openConfirm = useConfirmDialogStore((s) => s.openDialog);
  const navigate = useRouteStore((s) => s.navigate);
  const setStoreSection = useRouteStore((s) => s.setStoreSection);
  const launch = useLaunchStore((s) => s.launch);
  const launching = useLaunchStore((s) => s.launching);

  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  // 跳转到资源中心"原版游戏"分类创建实例
  const goCreateInstance = useCallback(() => {
    setStoreSection("game");
    navigate("store");
  }, [setStoreSection, navigate]);

  // 加载实例列表
  const loadInstances = useCallback(async () => {
    await fetchInstances(gameConfig.gameDir);
  }, [fetchInstances, gameConfig.gameDir]);

  useEffect(() => {
    loadInstances();
  }, [loadInstances]);

  // 默认选中第一个实例
  useEffect(() => {
    if (!selectedName && instances.length > 0) {
      setSelectedName(instances[0].name);
    }
    if (selectedName && !instances.some((i) => i.name === selectedName)) {
      setSelectedName(instances[0]?.name ?? null);
    }
  }, [instances, selectedName]);

  const selected = instances.find((i) => i.name === selectedName) ?? null;

  // 启动游戏（统一接口：主进程自动应用权威配置）
  const handlePlay = async () => {
    if (!selected) return;
    if (!user?.username || !user?.uuid) {
      toast.warning("请先在设置中登录账号");
      return;
    }
    try {
      await launch(selected.name, gameConfig.gameDir);
      const error = useLaunchStore.getState().error;
      if (error) {
        toast.error(`启动失败: ${error}`);
      } else {
        toast.success("游戏已启动");
      }
    } catch (e: any) {
      toast.error(`启动失败: ${e.message || e}`);
    }
  };

  // 删除实例（带确认）
  const handleDelete = () => {
    if (!selected) return;
    openConfirm({
      title: "删除实例",
      description: `确定要删除实例「${selected.config.description || selected.name}」吗？该操作将删除实例目录下所有文件，且无法恢复。`,
      confirmLabel: "删除",
      countdown: 5,
      onConfirm: async () => {
        try {
          await remove(selected.name, gameConfig.gameDir);
          // 同步移除 Koring.yml 中的记录
          setInstances(configInstances.filter((m) => m.name !== selected.name));
          setSelectedName(null);
          toast.success("实例已删除");
        } catch (e: any) {
          toast.error(`删除失败: ${e.message || e}`);
        }
      },
    });
  };

  // 编辑实例（显示名/内存）
  const handleEditSave = async (patch: { description?: string; minMemory?: number; maxMemory?: number }) => {
    if (!selected) return;
    try {
      await useInstanceStore.getState().select(selected.name, gameConfig.gameDir);
      // 更新 instance.json
      const result = await import("@/api/instance").then((m) =>
        m.updateInstance(selected.name, gameConfig.gameDir, patch)
      );
      // 刷新列表并同步 config 显示名
      await fetchInstances(gameConfig.gameDir);
      const updatedMeta = configInstances.map((m) =>
        m.name === selected.name ? { ...m, displayName: patch.description?.trim() || m.displayName } : m
      );
      setInstances(updatedMeta);
      if (result) toast.success("实例设置已保存");
    } catch (e: any) {
      toast.error(`保存失败: ${e.message || e}`);
    }
  };

  // 打开游戏目录
  const handleOpenFolder = async () => {
    if (!selected) return;
    const result = await openPath(selected.path);
    if (!result.success) {
      toast.error(`无法打开目录: ${result.error || "未知错误"}`);
    }
  };

  return (
    <div className="p-6 h-full overflow-y-auto scroll-area">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-foreground">实例管理</h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            创建、管理和启动 Minecraft 实例
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onPress={loadInstances} isDisabled={loading} className="min-w-0 w-8 h-8 p-0">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button size="sm" onPress={goCreateInstance}>
            <Plus className="w-4 h-4" />
            新建实例
          </Button>
        </div>
      </div>

      {/* 左右布局 */}
      <div className="grid grid-cols-[280px_1fr] gap-5 items-start">
        {/* 左侧：实例列表 */}
        <div className="min-w-0">
          <p className="text-[12px] font-medium text-muted-foreground/80 mb-2 px-1">
            我的实例（{instances.length}）
          </p>
          <InstanceList
            instances={instances}
            selectedName={selectedName}
            loading={loading}
            onSelect={setSelectedName}
          />
        </div>

        {/* 右侧：实例详情 */}
        <div className="min-w-0">
          {selected ? (
            <InstanceDetail
              instance={selected}
              isLaunching={launching}
              onPlay={handlePlay}
              onEdit={() => setEditOpen(true)}
              onOpenFolder={handleOpenFolder}
              onDelete={handleDelete}
            />
          ) : (
            <div className="flex flex-col items-center gap-4 py-24 rounded-2xl border border-dashed border-border/40 dark:border-white/[0.08]">
              <div className="w-16 h-16 rounded-full bg-foreground/[0.04] dark:bg-white/[0.04] flex items-center justify-center">
                <Gamepad2 className="w-8 h-8 text-muted-foreground/30" />
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  {loading ? "正在加载实例..." : "还没有任何实例"}
                </p>
                {!loading && (
                  <p className="text-[12px] text-muted-foreground/60 mt-1">
                    点击「新建实例」创建你的第一个游戏实例
                  </p>
                )}
              </div>
              {!loading && (
                <Button size="sm" onPress={goCreateInstance}>
                  <Plus className="w-4 h-4" />
                  新建实例
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      <EditDialog
        instance={selected}
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        onSave={handleEditSave}
      />
    </div>
  );
}
