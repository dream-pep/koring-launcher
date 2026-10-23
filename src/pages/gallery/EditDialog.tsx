//  __         __     __   __     ______     __  __     ______        __   __     ______     ______
// /\ \       /\ \   /\ "-.\ \   /\  ___\   /\ \/ /    /\  ___\      /\ "-.\ \   /\  ___\   /\__  _\
// \ \ \____  \ \ \  \ \ \-.  \  \ \ \__ \  \ \  _"-.  \ \  __\      \ \ \-.  \  \ \  __\   \/_/\ \/
//  \ \_____\  \ \_\  \ \_\\"\_\  \ \_____\  \ \_\ \_\  \ \_____\     \ \_\\"\_\  \ \_____\    \ \_\
//   \/_____/   \/_/   \/_/ \/_/   \/_____/   \/_/\/_/   \/_____/      \/_/ \/_/   \/_____/     \/_/
//
// 所有权利归Lingke Network (china)所有 | dream_pep拥有其艺术改变权力
// 未经允许的情况下删除此版权头可能会受到民事指控
// 请勿在未经Lingke Network (china)允许的范围内修改代码并分发

import { useEffect, useState } from "react";
import { Button, Slider } from "@heroui/react";
import { X, Loader2, Save, ImagePlus, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { ipcInvoke } from "@/api/ipc";
import { useInstanceStore } from "@/stores/instanceStore";
import type { InstanceInfo } from "@/api/instance";
import { InstanceIcon } from "./InstanceIcon";

interface EditDialogProps {
  instance: InstanceInfo | null;
  /** 实例所在游戏目录（写入图标时需要） */
  gamePath: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: (patch: {
    description?: string;
    category?: string;
    minMemory?: number;
    maxMemory?: number;
  }) => Promise<void>;
  /** 图标变化后通知外层刷新 */
  onIconChanged?: () => void;
}

export function EditDialog({
  instance,
  gamePath,
  isOpen,
  onClose,
  onSave,
  onIconChanged,
}: EditDialogProps) {
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [memory, setMemory] = useState(4);
  const [saving, setSaving] = useState(false);
  const [iconBusy, setIconBusy] = useState(false);
  const icon = useInstanceStore((state) => (instance ? state.icons[instance.name] : undefined));

  // 弹窗打开时回填当前值
  useEffect(() => {
    if (isOpen && instance) {
      setDescription(instance.config.description || "");
      setCategory(instance.config.category || "");
      setMemory(Math.round((instance.config.maxMemory || 4096) / 1024));
    }
  }, [isOpen, instance]);

  if (!isOpen || !instance) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        description: description.trim(),
        category: category.trim(),
        minMemory: Math.round(memory * 1024 * 0.25),
        maxMemory: memory * 1024,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  // 选择本地图片作为图标（写入实例目录 logo.png，优先于 icon.png 等）
  const handlePickIcon = async () => {
    const picked = await ipcInvoke<{ srcPath: string; ext: string } | null>("dialog:openFile", {
      filters: [{ name: "图片", extensions: ["png", "jpg", "jpeg", "webp"] }],
    });
    if (!picked?.srcPath) return;
    setIconBusy(true);
    try {
      await useInstanceStore.getState().setIcon(instance.name, gamePath, picked.srcPath);
      toast.success("图标已更新");
      onIconChanged?.();
    } catch (e: any) {
      toast.error(`设置图标失败: ${e?.message || e}`);
    } finally {
      setIconBusy(false);
    }
  };

  const handleResetIcon = async () => {
    setIconBusy(true);
    try {
      await useInstanceStore.getState().resetIcon(instance.name, gamePath);
      toast.success("已恢复默认图标");
      onIconChanged?.();
    } catch (e: any) {
      toast.error(`恢复默认图标失败: ${e?.message || e}`);
    } finally {
      setIconBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md mx-4 bg-background border border-border/50 dark:border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/30 dark:border-white/[0.04]">
          <div className="flex items-center gap-2">
            <Save className="w-4.5 h-4.5 text-primary" />
            <h2 className="text-base font-semibold text-foreground">编辑实例</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-foreground/[0.06] transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* 主体 */}
        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto scroll-area">
          {/* 图标 */}
          <div className="flex items-center gap-4">
            <InstanceIcon name={instance.name} icon={icon} className="w-16 h-16 rounded-2xl" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-foreground">实例图标</p>
              <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                也可直接把 logo.png 放进实例目录
                {icon?.problem ? `：${icon.problem}` : ""}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Button size="sm" variant="ghost" isDisabled={iconBusy} onPress={handlePickIcon}>
                  {iconBusy ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ImagePlus className="w-3.5 h-3.5" />
                  )}
                  选择图片
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  isDisabled={iconBusy || !icon?.url}
                  onPress={handleResetIcon}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  恢复默认
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-foreground">显示名称</label>
            <Input
              className="h-9"
              placeholder="实例显示名称"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground/60">留空则使用实例 ID（{instance.name}）</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-foreground">分类</label>
            <Input
              className="h-9"
              placeholder="例如：生存、整合包、测试"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground/60">
              相同分类的实例会在实例页聚合成筛选标签；留空表示未分类
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[13px] font-medium text-foreground">内存分配</p>
              <span className="text-[13px] font-semibold text-foreground">{memory} GB</span>
            </div>
            <Slider
              value={memory}
              onChange={(v) => setMemory(typeof v === "number" ? v : v[0])}
              minValue={1}
              maxValue={16}
              step={1}
            >
              <Slider.Track>
                <Slider.Fill />
                <Slider.Thumb />
              </Slider.Track>
            </Slider>
          </div>
        </div>

        {/* 底部 */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border/30 dark:border-white/[0.04]">
          <Button variant="ghost" onPress={onClose}>取消</Button>
          <Button onPress={handleSave} isDisabled={saving}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? "保存中..." : "保存"}
          </Button>
        </div>
      </div>
    </div>
  );
}
