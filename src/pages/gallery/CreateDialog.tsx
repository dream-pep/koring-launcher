import { useState, useEffect } from "react";
import { Button, Input, RadioGroup, Radio, Slider } from "@heroui/react";
import { X, Loader2, Plus } from "lucide-react";
import { getMinecraftVersionList, getFabricVersionList, getForgeVersionList, getQuiltVersionList, type InstanceRuntime } from "@/api/instance";

interface CreateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, runtime: InstanceRuntime, displayName?: string) => Promise<void>;
}

const loaderOptions = [
  { value: "vanilla", label: "原版 (Vanilla)", desc: "纯净 Minecraft，无模组加载器" },
  { value: "forge", label: "Forge", desc: "最经典的模组加载器，模组生态最丰富" },
  { value: "fabric", label: "Fabric", desc: "轻量快速，适合性能优化与辅助模组" },
  { value: "quilt", label: "Quilt", desc: "Fabric 的分支，实验性功能更多" },
  { value: "neoforged", label: "NeoForge", desc: "Forge 的现代化分支，1.20+ 推荐" },
];

export function CreateDialog({ isOpen, onClose, onCreate }: CreateDialogProps) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loader, setLoader] = useState("vanilla");
  const [mcVersion, setMcVersion] = useState("");
  const [memory, setMemory] = useState(4);
  const [creating, setCreating] = useState(false);
  const [mcVersions, setMcVersions] = useState<string[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) { loadMcVersions(); } else { resetForm(); }
  }, [isOpen]);

  const resetForm = () => {
    setStep(0); setName(""); setDisplayName("");
    setLoader("vanilla"); setMcVersion(""); setMemory(4);
    setError(""); setCreating(false);
  };

  const loadMcVersions = async () => {
    setLoadingVersions(true);
    try {
      const list = await getMinecraftVersionList();
      const releases = list.filter((v: string) => /^1\.\d+/.test(v)).slice(0, 24);
      setMcVersions(releases.length ? releases : ["1.21.4","1.21","1.20.6","1.20.4","1.20.1","1.19.4","1.19.2","1.18.2","1.17.1","1.16.5"]);
      if (!mcVersion && releases.length) setMcVersion(releases[0]);
    } catch { setMcVersions(["1.21.4","1.21","1.20.1","1.19.2","1.18.2","1.16.5"]); if (!mcVersion) setMcVersion("1.21.4"); }
    setLoadingVersions(false);
  };

  const handleCreate = async () => {
    if (!name.trim()) { setError("请输入实例名称"); return; }
    setCreating(true);
    try {
      const runtime: any = { minecraft: mcVersion };
      if (loader === "forge") runtime.forge = "latest";
      else if (loader === "fabric") runtime.fabricLoader = "latest";
      else if (loader === "quilt") runtime.quiltLoader = "latest";
      else if (loader === "neoforged") runtime.neoForged = "latest";
      await onCreate(name.trim(), runtime, displayName.trim() || undefined);
      onClose();
    } catch (e: any) { setError(e.message || "创建失败"); }
    setCreating(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg mx-4 bg-background border border-border/50 dark:border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/30 dark:border-white/[0.04]">
          <div className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary" />
            <h2 className="text-base font-semibold text-foreground">新建实例</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-foreground/[0.06] transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5 max-h-[60vh] overflow-y-auto scroll-area">
          {/* 步骤指示器 */}
          <div className="flex items-center gap-2">
            {["基本信息", "版本选择", "内存设置"].map((label, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium shrink-0 transition-colors ${
                  i === step ? "bg-primary text-primary-foreground" :
                  i < step ? "bg-primary/20 text-primary" :
                  "bg-foreground/[0.06] dark:bg-white/[0.06] text-muted-foreground"
                }`}>{i < step ? "✓" : i + 1}</div>
                <span className={`text-[12px] ${i === step ? "text-foreground font-medium" : "text-muted-foreground"}`}>{label}</span>
                {i < 2 && <div className="w-5 h-px bg-border/40" />}
              </div>
            ))}
          </div>

          {step === 0 && (
            <div className="space-y-4">
              <Input label="实例名称 (英文ID)" placeholder="例如: survival-world"
                value={name} onChange={(e) => setName(e.target.value.replace(/\s/g, "-").toLowerCase())} autoFocus />
              <Input label="显示名称 (可选)" placeholder="例如: 生存世界"
                value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-foreground mb-2">Minecraft 版本</p>
                {loadingVersions ? (
                  <div className="flex items-center gap-2 py-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /><span className="text-sm text-muted-foreground">加载中...</span></div>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {mcVersions.map((v) => (
                      <button key={v} onClick={() => setMcVersion(v)}
                        className={`px-3 py-2 rounded-lg text-[13px] border transition-all ${
                          mcVersion === v
                            ? "border-primary bg-primary/10 text-primary font-medium"
                            : "border-border/40 dark:border-white/[0.06] text-muted-foreground hover:border-primary/30 hover:text-foreground"
                        }`}>{v}</button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="text-sm font-medium text-foreground mb-2">模组加载器</p>
                <RadioGroup value={loader} onValueChange={setLoader}>
                  {loaderOptions.map((opt) => (
                    <Radio key={opt.value} value={opt.value} className="py-1.5">
                      <Radio.Content>
                        <div><p className="text-sm font-medium">{opt.label}</p><p className="text-[11px] text-muted-foreground">{opt.desc}</p></div>
                      </Radio.Content>
                    </Radio>
                  ))}
                </RadioGroup>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-foreground">内存分配</p>
                  <span className="text-sm font-semibold text-foreground">{memory} GB</span>
                </div>
                <Slider value={memory} onChange={(v) => setMemory(typeof v === "number" ? v : v[0])} minValue={1} maxValue={16} step={1}>
                  <Slider.Track><Slider.Fill /><Slider.Thumb /></Slider.Track>
                </Slider>
              </div>
              <div className="p-3 rounded-lg bg-foreground/[0.03] dark:bg-white/[0.03] border border-border/30 dark:border-white/[0.04] space-y-1">
                <p className="text-[12px] font-medium text-foreground">创建摘要</p>
                <p className="text-[13px] text-muted-foreground">名称: {displayName || name}</p>
                <p className="text-[13px] text-muted-foreground">版本: Minecraft {mcVersion} ({loaderOptions.find(o=>o.value===loader)?.label})</p>
                <p className="text-[13px] text-muted-foreground">内存: {memory} GB</p>
              </div>
            </div>
          )}

          {error && <p className="text-[12px] text-destructive">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border/30 dark:border-white/[0.04]">
          <div>
            {step > 0 && <Button variant="light" onPress={() => setStep(step - 1)}>上一步</Button>}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="light" onPress={onClose}>取消</Button>
            {step < 2 ? (
              <Button onPress={() => setStep(step + 1)} isDisabled={step === 0 ? !name.trim() : !mcVersion}>下一步</Button>
            ) : (
              <Button onPress={handleCreate} isDisabled={creating || !name.trim()}
                startContent={creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : undefined}>
                {creating ? "创建中..." : "创建实例"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
