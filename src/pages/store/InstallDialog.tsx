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
import { createPortal } from "react-dom";
import { Button, Input, Modal } from "@heroui/react";
import { Loader2, Box, Check } from "lucide-react";
import { toast } from "sonner";
import { useConfigStore } from "@/stores/configStore";
import { useTaskStore } from "@/stores/taskStore";
import type { InstanceRuntime } from "@/api/instance";

// 加载器选项
const LOADER_OPTIONS = [
  { value: "vanilla", label: "原版", desc: "纯净 Minecraft，无需模组加载器" },
  { value: "forge", label: "Forge", desc: "最经典的模组加载器" },
  { value: "neoforged", label: "NeoForge", desc: "Forge 的现代化分支，1.20+ 推荐" },
  { value: "fabric", label: "Fabric", desc: "轻量快速，适合性能优化与辅助模组" },
] as const;

type LoaderType = typeof LOADER_OPTIONS[number]["value"];

interface InstallDialogProps {
  versionId: string | null;
  onClose: () => void;
}

export function InstallDialog({ versionId, onClose }: InstallDialogProps) {
  const gameDir = useConfigStore((s) => s.config.game.gameDir);
  const { addSidecarTask } = useTaskStore();

  const [step, setStep] = useState(0);
  const [instanceName, setInstanceName] = useState("");
  const [loader, setLoader] = useState<LoaderType>("vanilla");
  const [loaderVersion, setLoaderVersion] = useState("latest");
  const [installing, setInstalling] = useState(false);
  // 关闭动画期间保留版本号，避免内容提前消失
  const [displayVersion, setDisplayVersion] = useState<string | null>(null);

  // 弹窗打开时用版本号预填名称
  useEffect(() => {
    if (versionId) {
      setDisplayVersion(versionId);
      setInstanceName(versionId);
      setStep(0);
      setLoader("vanilla");
      setLoaderVersion("latest");
      setInstalling(false);
    }
  }, [versionId]);

  const steps = ["命名实例", "选择加载器", "加载器版本", "确认配置"];

  // 点击"安装"→提交到任务队列
  const handleInstall = () => {
    if (!versionId) return;
    const runtime: InstanceRuntime = { minecraft: versionId };
    if (loader === "forge") runtime.forge = loaderVersion;
    else if (loader === "fabric") runtime.fabricLoader = loaderVersion;
    else if (loader === "neoforged") runtime.neoForged = loaderVersion;

    setInstalling(true);

    const label = loader === "vanilla" ? "原版" : LOADER_OPTIONS.find((o) => o.value === loader)?.label ?? loader;
    const loaderInfo = loader === "vanilla" ? "" : ` (${label} ${loaderVersion})`;

    // 加入任务队列
    addSidecarTask({
      type: "install",
      title: `创建实例: ${instanceName}`,
      description: `Minecraft ${versionId}${loaderInfo}`,
      executorName: "install",
      params: {
        name: instanceName,
        gamePath: gameDir,
        runtime,
        description: instanceName,
      },
    });

    toast.success("已加入任务队列，可在任务面板查看进度");
    onClose();
  };

  const valid = instanceName.trim().length > 0;

  // Modal 通过 Portal 渲染到 body，确保全屏覆盖而不被内容区裁剪
  return createPortal(
    <Modal.Root isOpen={!!versionId} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Modal.Backdrop variant="blur" isDismissable>
        <Modal.Container placement="center">
          <Modal.Dialog className="rounded-2xl">{/* ... 内容不变 ... */}
            <Modal.CloseTrigger />

            {/* 头部 */}
            <Modal.Header className="flex items-center gap-2">
              <Box className="w-4.5 h-4.5 text-primary" />
              <Modal.Heading className="text-base font-semibold">
                安装 Minecraft {displayVersion}
              </Modal.Heading>
            </Modal.Header>

            <Modal.Body className="max-h-[55vh] overflow-y-auto scroll-area">
              {/* 步骤指示器 */}
              <div className="flex items-center gap-1.5 pb-4">
                {steps.map((label, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 transition-colors ${
                        i === step
                          ? "bg-primary text-primary-foreground"
                          : i < step
                          ? "bg-primary/20 text-primary"
                          : "bg-foreground/[0.06] dark:bg-white/[0.06] text-muted-foreground"
                      }`}
                    >
                      {i < step ? <Check className="w-3 h-3" /> : i + 1}
                    </div>
                    <span className={`text-[11px] ${i === step ? "text-foreground font-medium" : "text-muted-foreground"} hidden sm:inline`}>
                      {label}
                    </span>
                    {i < 3 && <div className="w-5 h-px bg-border/40 hidden sm:block" />}
                  </div>
                ))}
              </div>

              {/* 步骤内容 */}
              <div className="space-y-5">
                {step === 0 && (
                  <div className="space-y-3 setting-page-enter">
                    <p className="text-[13px] text-muted-foreground">为此版本命名，默认为版本号</p>
                    <Input
                      fullWidth
                      placeholder="实例名称（如 survival-world）"
                      value={instanceName}
                      onChange={(e) => setInstanceName(e.target.value.replace(/\s/g, "-").toLowerCase())}
                      autoFocus
                    />
                  </div>
                )}

                {step === 1 && (
                  <div className="space-y-2 setting-page-enter">
                    <p className="text-[13px] text-muted-foreground mb-1">选择模组加载器</p>
                    {LOADER_OPTIONS.map((opt) => {
                      const active = loader === opt.value;
                      return (
                        <button
                          key={opt.value}
                          onClick={() => setLoader(opt.value)}
                          className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                            active
                              ? "border-primary bg-primary/10"
                              : "border-border/40 dark:border-white/[0.06] hover:border-primary/30"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <p className={`text-[13.5px] font-semibold ${active ? "text-primary" : "text-foreground"}`}>
                              {opt.label}
                            </p>
                            <Check className={`w-4 h-4 ${active ? "text-primary" : "text-transparent"}`} />
                          </div>
                          <p className="text-[11.5px] text-muted-foreground/70 mt-0.5">{opt.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                )}

                {step === 2 && loader !== "vanilla" && (
                  <div className="space-y-3 setting-page-enter">
                    <p className="text-[13px] text-muted-foreground">
                      选择 {LOADER_OPTIONS.find((o) => o.value === loader)?.label} 版本
                    </p>
                    <Input
                      fullWidth
                      placeholder="输入版本号（如 latest、0.16.10）"
                      value={loaderVersion}
                      onChange={(e) => setLoaderVersion(e.target.value)}
                      autoFocus
                    />
                    <p className="text-[11px] text-muted-foreground/60">
                      使用 "latest" 安装最新版，或指定具体版本号。版本列表加载可能需要网络以获取实时数据。
                    </p>
                  </div>
                )}

                {step === 2 && loader === "vanilla" && (
                  <div className="py-6 text-center setting-page-enter">
                    <Box className="w-8 h-8 mx-auto text-muted-foreground/30" />
                    <p className="text-[13px] text-muted-foreground mt-3">原版 Minecraft 无需加载器</p>
                    <p className="text-[12px] text-muted-foreground/60 mt-1">直接点击下一步进入确认</p>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-3 setting-page-enter">
                    <p className="text-[14px] font-semibold text-foreground text-center">请确认配置</p>
                    <div className="rounded-xl border border-border/40 dark:border-white/[0.06] bg-foreground/[0.02] dark:bg-white/[0.02] divide-y divide-border/30 dark:divide-white/[0.05]">
                      <ConfigRow label="Minecraft 版本" value={displayVersion ?? ""} />
                      <ConfigRow label="实例名称" value={instanceName} />
                      <ConfigRow label="模组加载器" value={LOADER_OPTIONS.find((o) => o.value === loader)?.label ?? "原版"} />
                      {loader !== "vanilla" && (
                        <ConfigRow label="加载器版本" value={loaderVersion} />
                      )}
                    </div>
                  </div>
                )}
              </div>
            </Modal.Body>

            {/* 底部操作 */}
            <Modal.Footer className="flex items-center justify-between">
              <div>
                {step > 0 && (
                  <Button variant="ghost" onPress={() => setStep(step - 1)}>上一步</Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" onPress={onClose}>取消</Button>
                {step < 3 ? (
                  <Button onPress={() => setStep(step + 1)} isDisabled={step === 0 ? !valid : false}>
                    下一步
                  </Button>
                ) : (
                  <Button onPress={handleInstall} isDisabled={installing || !valid}>
                    {installing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    安装
                  </Button>
                )}
              </div>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal.Root>,
    document.body,
  );
}

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="text-[12px] text-muted-foreground">{label}</span>
      <span className="text-[13px] font-medium text-foreground">{value}</span>
    </div>
  );
}
