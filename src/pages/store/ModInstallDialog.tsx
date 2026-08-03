//  __         __     __   __     ______     __  __     ______        __   __     ______     ______
// /\ \       /\ \   /\ "-.\ \   /\  ___\   /\ \/ /    /\  ___\      /\ "-.\ \   /\  ___\   /\__  _\
// \ \ \____  \ \ \  \ \ \-.  \  \ \ \__ \  \ \  _"-.  \ \  __\      \ \ \-.  \  \ \  __\   \/_/\ \/
//  \ \_____\  \ \_\  \ \_\\"\_\  \ \_____\  \ \_\ \_\  \ \_____\     \ \_\\"\_\  \ \_____\    \ \_\
//   \/_____/   \/_/   \/_/ \/_/   \/_____/   \/_/\/_/   \/_____/      \/_/ \/_/   \/_____/     \/_/
//
// 所有权利归Lingke Network (china)所有 | dream_pep拥有其艺术改变权力
// 未经允许的情况下删除此版权头可能会受到民事指控
// 请勿在未经Lingke Network (china)允许的范围内修改代码并分发

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@heroui/react";
import { X, Loader2, Download, FolderOpen, Package } from "lucide-react";
import { toast } from "sonner";
import type { ModSearchResult, ModVersionResult } from "@/api/mods";
import { useModsStore } from "@/stores/modsStore";
import { useInstanceStore } from "@/stores/instanceStore";
import { useConfigStore } from "@/stores/configStore";

interface ModInstallDialogProps {
  mod: ModSearchResult | null;
  gameVersion?: string;
  loader?: string;
  onClose: () => void;
}

export function ModInstallDialog({ mod, gameVersion, loader, onClose }: ModInstallDialogProps) {
  const { modVersions, getVersions, install, installing, clearError } = useModsStore();
  const { instances, fetchInstances } = useInstanceStore();
  const gameDir = useConfigStore((s) => s.config.game.gameDir);

  const [selectedVersion, setSelectedVersion] = useState<ModVersionResult | null>(null);
  const [selectedInstance, setSelectedInstance] = useState<string>("");

  useEffect(() => {
    if (!mod) return;
    setSelectedVersion(null);
    clearError();
    getVersions(mod.id, gameVersion, loader, mod.source);
  }, [mod, gameVersion, loader, getVersions, clearError]);

  useEffect(() => {
    if (!mod) return;
    fetchInstances(gameDir);
  }, [mod, gameDir, fetchInstances]);

  useEffect(() => {
    if (!selectedInstance && instances.length > 0) {
      setSelectedInstance(instances[0].name);
    }
  }, [instances, selectedInstance]);

  useEffect(() => {
    if (!selectedVersion && modVersions.length > 0) {
      setSelectedVersion(modVersions[0]);
    }
  }, [modVersions, selectedVersion]);

  const visibleVersions = useMemo(() => {
    if (!gameVersion && !loader) return modVersions;
    return modVersions.filter((v) => {
      const matchVersion = !gameVersion || v.gameVersions.includes(gameVersion);
      const matchLoader = !loader || v.loaders.includes(loader);
      return matchVersion && matchLoader;
    });
  }, [modVersions, gameVersion, loader]);

  if (!mod) return null;

  const handleInstall = async () => {
    if (!selectedVersion) { toast.warning("请先选择一个 Mod 版本"); return; }
    if (!selectedInstance) { toast.warning("请先选择一个目标实例"); return; }
    const target = instances.find((i) => i.name === selectedInstance);
    if (!target) { toast.warning("目标实例不存在"); return; }

    await install(mod.id, selectedVersion.id, target.path, mod.source);
    const { error } = useModsStore.getState();
    if (error) { toast.error(`安装失败: ${error}`); clearError(); }
    else { toast.success(`「${mod.name}」已安装到 ${target.config.description || target.name}`); onClose(); }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-xl mx-4 bg-background border border-border/50 dark:border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/30 dark:border-white/[0.04]">
          <div className="flex items-center gap-3 min-w-0">
            {mod.iconUrl ? (
              <img src={mod.iconUrl} alt={mod.name} className="w-9 h-9 rounded-lg object-cover shrink-0"
                onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
            ) : (
              <div className="w-9 h-9 rounded-lg bg-foreground/[0.05] dark:bg-white/[0.05] flex items-center justify-center shrink-0">
                <Package className="w-4.5 h-4.5 text-muted-foreground/50" />
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-foreground truncate">{mod.name}</h2>
              <p className="text-[11px] text-muted-foreground truncate">{mod.description}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-foreground/[0.06] transition-colors shrink-0"><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <div className="px-6 py-5 space-y-5 max-h-[55vh] overflow-y-auto scroll-area">
          <div>
            <p className="text-sm font-medium text-foreground mb-2.5">选择版本</p>
            {modVersions.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground/60 text-sm">正在加载版本列表...</div>
            ) : visibleVersions.length === 0 ? (
              <div className="py-6 text-center text-[13px] text-muted-foreground">没有匹配的版本</div>
            ) : (
              <div className="space-y-1.5 max-h-56 overflow-y-auto scroll-area pr-1">
                {visibleVersions.slice(0, 12).map((v) => {
                  const active = selectedVersion?.id === v.id;
                  return (
                    <button key={v.id} onClick={() => setSelectedVersion(v)}
                      className={`w-full text-left px-3 py-2 rounded-lg border transition-all ${active ? "border-primary bg-primary/10" : "border-border/40 dark:border-white/[0.06] hover:border-primary/30"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-[13px] font-medium truncate ${active ? "text-primary" : "text-foreground"}`}>{v.versionNumber || v.name}</span>
                        {v.loaders.length > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-foreground/[0.05] text-muted-foreground shrink-0">{v.loaders.join("/")}</span>}
                      </div>
                      {v.gameVersions.length > 0 && <p className="text-[10.5px] text-muted-foreground/70 mt-0.5 truncate">支持: {v.gameVersions.slice(0, 6).join(", ")}</p>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-foreground mb-2.5">安装到实例</p>
            {instances.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground/60 text-[13px]"><FolderOpen className="w-4 h-4" />暂无实例</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {instances.map((inst) => {
                  const active = selectedInstance === inst.name;
                  return (
                    <button key={inst.name} onClick={() => setSelectedInstance(inst.name)}
                      className={`text-left px-3 py-2 rounded-lg border transition-all ${active ? "border-primary bg-primary/10" : "border-border/40 dark:border-white/[0.06] hover:border-primary/30"}`}>
                      <p className={`text-[13px] font-medium truncate ${active ? "text-primary" : "text-foreground"}`}>{inst.config.description || inst.name}</p>
                      <p className="text-[10.5px] text-muted-foreground/70 mt-0.5 truncate">{inst.config.runtime.minecraft} · {inst.name}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between px-6 py-4 border-t border-border/30 dark:border-white/[0.04]">
          <p className="text-[12px] text-muted-foreground/70">{selectedVersion?.files[0]?.filename ? `文件: ${selectedVersion.files[0].filename}` : "选择版本后点击安装"}</p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onPress={onClose}>取消</Button>
            <Button onPress={handleInstall} isDisabled={installing || !selectedVersion || !selectedInstance}>
              {installing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              {installing ? "安装中..." : "安装"}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
