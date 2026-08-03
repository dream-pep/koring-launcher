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
import { X, Loader2, Save } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { InstanceInfo } from "@/api/instance";

interface EditDialogProps {
  instance: InstanceInfo | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (patch: { description?: string; minMemory?: number; maxMemory?: number }) => Promise<void>;
}

export function EditDialog({ instance, isOpen, onClose, onSave }: EditDialogProps) {
  const [description, setDescription] = useState("");
  const [memory, setMemory] = useState(4);
  const [saving, setSaving] = useState(false);

  // 弹窗打开时回填当前值
  useEffect(() => {
    if (isOpen && instance) {
      setDescription(instance.config.description || "");
      setMemory(Math.round((instance.config.maxMemory || 4096) / 1024));
    }
  }, [isOpen, instance]);

  if (!isOpen || !instance) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        description: description.trim(),
        minMemory: Math.round(memory * 1024 * 0.25),
        maxMemory: memory * 1024,
      });
      onClose();
    } finally {
      setSaving(false);
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
        <div className="px-6 py-5 space-y-5">
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
          <Button
            onPress={handleSave}
            isDisabled={saving}
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? "保存中..." : "保存"}
          </Button>
        </div>
      </div>
    </div>
  );
}
