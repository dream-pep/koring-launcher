import { useCallback, useEffect, useState } from "react";
import { Button, Slider } from "@heroui/react";
import { Cpu, Loader2, RefreshCw, Check, AlertCircle, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { useConfigStore } from "@/stores/configStore";
import { useInstanceStore } from "@/stores/instanceStore";
import { scanJava, resolveJava, getJavaPlan, type JavaInfo, type JavaPlan } from "@/api/java";
import {
  SettingCard,
  SettingRow,
  SettingSelect,
  SettingSwitch,
  SettingRadioGroup,
  SettingTextArea,
  SettingFilePicker,
  SettingListItem,
  SettingBadge,
  PageHeader,
  SectionTitle,
} from "@/components/setting";

const gcOptions = [
  { value: "auto", label: "不指定（由 Java 自动选择）" },
  { value: "zgc", label: "ZGC（低延迟，需要 Java 15+）" },
  { value: "g1", label: "G1GC（标准，兼容性好）" },
];

// 根据路径推断发行版名称（展示用）
function javaVendorLabel(j: JavaInfo | { path: string }): string {
  const p = j.path.toLowerCase();
  if (p.includes("temurin") || p.includes("adoptium")) return "Eclipse Temurin";
  if (p.includes("zulu")) return "Azul Zulu";
  if (p.includes("corretto") || p.includes("amazon")) return "Amazon Corretto";
  if (p.includes("microsoft")) return "Microsoft OpenJDK";
  if (p.includes("oracle") || p.includes("jdk") || p.includes("java")) return "OpenJDK";
  return "Java";
}

export function JavaMemSetting() {
  const java = useConfigStore((s) => s.config.java);
  const setJava = useConfigStore((s) => s.setJava);
  const currentInstance = useInstanceStore((s) => s.currentInstance);
  const instances = useInstanceStore((s) => s.instances);

  const [scanning, setScanning] = useState(false);
  const [javaList, setJavaList] = useState<JavaInfo[]>([]);
  const [validated, setValidated] = useState<JavaInfo | null>(null);
  const [validating, setValidating] = useState(false);
  const [plan, setPlan] = useState<JavaPlan | null>(null);
  const [planning, setPlanning] = useState(false);

  // 自动匹配预览使用的参考版本：当前实例 → 第一个实例 → 最新版
  const reference = currentInstance ?? instances[0] ?? null;
  const referenceVersion = reference?.config.runtime.minecraft ?? "1.21";
  const referenceLabel = reference ? `${reference.name}（${referenceVersion}）` : "未选择实例（按最新版预估）";

  const loadPlan = useCallback(async () => {
    setPlanning(true);
    try {
      setPlan(await getJavaPlan(referenceVersion));
    } catch (e: any) {
      setPlan(null);
      toast.error(`自动匹配失败: ${e?.message || e}`);
    }
    setPlanning(false);
  }, [referenceVersion]);

  useEffect(() => {
    if (java.autoJavaPath) {
      void loadPlan();
    }
  }, [java.autoJavaPath, loadPlan]);

  // 扫描系统 Java
  const handleScan = useCallback(async () => {
    setScanning(true);
    try {
      const list = await scanJava();
      setJavaList(list);
      if (list.length === 0) {
        toast.info("未检测到已安装的 Java，请手动指定路径");
      } else {
        toast.success(`检测到 ${list.length} 个 Java 环境`);
      }
    } catch (e: any) {
      toast.error(`检测失败: ${e?.message || e}`);
    }
    setScanning(false);
  }, []);

  // 配置路径变化后自动校验（700ms debounce，避免每次按键都 spawn java）
  useEffect(() => {
    if (!java.javaPath.trim()) {
      setValidated(null);
      setValidating(false);
      return;
    }
    setValidating(true);
    const timer = setTimeout(async () => {
      try {
        const info = await resolveJava(java.javaPath.trim());
        setValidated(info);
      } catch {
        setValidated(null);
      }
      setValidating(false);
    }, 700);
    return () => clearTimeout(timer);
  }, [java.javaPath]);

  const isCurrent = (path: string) => java.javaPath === path;
  const pickedName = plan?.pickedPath?.split(/[\\/]/).pop() ?? "";

  return (
    <div>
      <PageHeader title="Java 虚拟机与内存" desc="配置 Java 运行环境、内存分配与 JVM 参数" />

      <div className="space-y-6">
        {/* Java 环境 */}
        <div>
          <SectionTitle>Java 环境</SectionTitle>
          <div className="space-y-3">
            <SettingCard>
              <SettingSwitch
                label="自动选择 Java"
                desc="按实例的 Minecraft 版本自动挑选最合适的本机 Java（1.20.5+ 用 Java 21、1.17–1.20.4 用 Java 17、1.16.5- 用 Java 8）"
                checked={java.autoJavaPath}
                onChange={(v) => setJava({ autoJavaPath: v })}
              />
            </SettingCard>

            {java.autoJavaPath && (
              <SettingCard>
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground">自动匹配预览</p>
                        {plan && <SettingBadge variant="info">需要 Java {plan.requiredMajor}</SettingBadge>}
                      </div>
                      <p className="text-[13px] text-muted-foreground mt-0.5">
                        参考版本：{referenceLabel}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onPress={loadPlan} isDisabled={planning} className="shrink-0">
                      {planning ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5" />
                      )}
                      重新检测
                    </Button>
                  </div>

                  {plan?.pickedPath ? (
                    <SettingListItem selected>
                      <Wand2 className="w-4 h-4 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          将使用 Java {plan.requiredMajor} · {pickedName}
                        </p>
                        <p className="text-[11px] text-muted-foreground/60 mt-0.5 font-mono truncate">
                          {plan.pickedPath}
                        </p>
                      </div>
                    </SettingListItem>
                  ) : (
                    <p className="text-[12px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      本机未找到可用 Java：请先安装 Java，或关闭自动选择并手动指定路径
                    </p>
                  )}

                  {plan && plan.candidates.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[12px] text-muted-foreground/70">
                        本机 Java（{plan.candidates.length} 个）
                      </p>
                      {plan.candidates.slice(0, 6).map((c) => (
                        <div key={c.path} className="flex items-center gap-2 text-[12px]">
                          <span className="text-muted-foreground shrink-0">
                            Java {c.majorVersion ?? "?"}
                          </span>
                          <span className="font-mono text-foreground/70 truncate" title={c.path}>
                            {c.path}
                          </span>
                          {c.path === plan.pickedPath && <SettingBadge variant="success">自动选中</SettingBadge>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </SettingCard>
            )}

            <SettingCard>
              <div className="space-y-3">
                <SettingRow
                  label="手动指定路径"
                  desc={
                    java.autoJavaPath
                      ? "自动选择已开启：仅在自动匹配失败时使用此路径"
                      : "指向 javaw.exe / java.exe 完整路径，输入后自动校验"
                  }
                >
                  <Button size="sm" variant="outline" onPress={handleScan} isDisabled={scanning}>
                    {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    {scanning ? "检测中..." : "检测本机 Java"}
                  </Button>
                </SettingRow>
                <SettingFilePicker
                  label=""
                  value={java.javaPath}
                  onChange={(v) => setJava({ javaPath: v })}
                  placeholder="例如 C:\Program Files\Java\jdk-21\bin\javaw.exe"
                  mode="file"
                  filters={[{ name: "Java 可执行文件", extensions: ["exe"] }]}
                  showCheck={!!validated}
                />
                {validating && (
                  <p className="text-[12px] text-muted-foreground flex items-center gap-1">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    正在校验...
                  </p>
                )}
                {validated && (
                  <p className="text-[12px] text-green-600 dark:text-green-400 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" />
                    {javaVendorLabel(validated)} {validated.version}（Java {validated.majorVersion}）
                  </p>
                )}
                {!validating && java.javaPath.trim() && !validated && (
                  <p className="text-[12px] text-red-500/80 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    路径无效或无法解析 Java 版本
                  </p>
                )}
              </div>
            </SettingCard>

            {javaList.length > 0 && (
              <SettingCard>
                <div className="space-y-2">
                  <p className="text-[12px] text-muted-foreground/70">检测结果（点击「使用」并关闭自动选择）</p>
                  {javaList.map((j) => {
                    const current = isCurrent(j.path);
                    return (
                      <SettingListItem key={j.path} selected={current}>
                        <Cpu className="w-4 h-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">
                            {javaVendorLabel(j)} {j.version}
                          </p>
                          <p className="text-[11px] text-muted-foreground/60 mt-0.5 font-mono truncate">{j.path}</p>
                        </div>
                        <Button
                          size="sm"
                          variant={current ? "primary" : "outline"}
                          className="shrink-0"
                          isDisabled={current}
                          onPress={() => setJava({ javaPath: j.path, autoJavaPath: false })}
                        >
                          {current ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              当前
                            </>
                          ) : (
                            "使用"
                          )}
                        </Button>
                      </SettingListItem>
                    );
                  })}
                </div>
              </SettingCard>
            )}
          </div>
        </div>

        {/* 内存分配 */}
        <div>
          <SectionTitle>内存分配</SectionTitle>
          <div className="space-y-3">
            <SettingCard>
              <div className="space-y-4">
                <SettingRadioGroup
                  value={java.memMode}
                  options={[
                    { value: "auto", label: "自动配置" },
                    { value: "custom", label: "自定义" },
                  ]}
                  onChange={(v) => setJava({ memMode: v })}
                  horizontal
                />
                {java.memMode === "auto" ? (
                  <p className="text-[12px] text-muted-foreground">
                    自动配置由启动器按实例默认值分配：最小 1 GB、最大 4 GB（实例可单独覆盖）。
                  </p>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[13px] text-muted-foreground">分配内存</span>
                      <span className="text-[13px] text-muted-foreground tabular-nums">{java.memGB} GB</span>
                    </div>
                    <Slider
                      value={java.memGB}
                      onChange={(v) => setJava({ memGB: typeof v === "number" ? v : v[0] })}
                      minValue={1}
                      maxValue={16}
                      step={1}
                    >
                      <Slider.Track>
                        <Slider.Fill />
                        <Slider.Thumb />
                      </Slider.Track>
                    </Slider>
                    <div className="flex justify-between mt-1">
                      <span className="text-[11px] text-muted-foreground/50">1 GB</span>
                      <span className="text-[11px] text-muted-foreground/50">16 GB</span>
                    </div>
                    <p className="text-[12px] text-muted-foreground mt-2">
                      实际参数：<code className="font-mono text-foreground/80">
                        -Xms{Math.min(2, java.memGB)}G -Xmx{java.memGB}G
                      </code>
                    </p>
                  </div>
                )}
              </div>
            </SettingCard>
          </div>
        </div>

        {/* JVM 参数 */}
        <div>
          <SectionTitle>JVM 参数</SectionTitle>
          <div className="space-y-3">
            <SettingCard>
              <SettingTextArea
                label="额外 JVM 启动参数"
                desc="按空格或换行分隔，例如 -XX:+UseZGC；支持引号包裹含空格的值"
                value={java.jvmArgs}
                onChange={(v) => setJava({ jvmArgs: v })}
                rows={3}
                placeholder="可选，留空使用默认参数"
              />
            </SettingCard>
          </div>
        </div>

        {/* 垃圾回收 */}
        <div>
          <SectionTitle>垃圾回收</SectionTitle>
          <div className="space-y-3">
            <SettingCard>
              <SettingSelect
                label="GC 算法"
                desc="ZGC 需要 Java 15+；不指定则由 Java 按版本自行选择"
                value={java.gc}
                options={gcOptions}
                onChange={(v) => setJava({ gc: v })}
              />
            </SettingCard>
          </div>
        </div>
      </div>
    </div>
  );
}
