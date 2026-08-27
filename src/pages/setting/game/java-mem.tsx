import { useCallback, useEffect, useState } from "react";
import { Button, Slider, Skeleton } from "@heroui/react";
import { Cpu, Loader2, RefreshCw, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useConfigStore } from "@/stores/configStore";
import { scanJava, resolveJava, type JavaInfo } from "@/api/java";
import {
  SettingCard,
  SettingRow,
  SettingSelect,
  SettingRadioGroup,
  SettingTextArea,
  SettingFilePicker,
  SettingListItem,
  PageHeader,
  SectionTitle,
} from "@/components/setting";

const gcOptions = [
  { value: "auto", label: "不指定（由 Java 自动选择）" },
  { value: "zgc", label: "ZGC（低延迟，推荐 Java 21+）" },
  { value: "g1", label: "G1GC（标准，兼容性好）" },
];

// 根据路径推断发行版名称（展示用）
function javaVendorLabel(j: JavaInfo): string {
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

  const [scanning, setScanning] = useState(false);
  const [javaList, setJavaList] = useState<JavaInfo[]>([]);
  const [validated, setValidated] = useState<JavaInfo | null>(null);
  const [validating, setValidating] = useState(false);

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

  return (
    <div>
      <PageHeader title="Java 虚拟机与内存" desc="配置 Java 运行环境路径、JVM 参数与游戏内存分配" />

      <div className="space-y-6">
        {/* Java 环境 */}
        <div>
          <SectionTitle>Java 环境</SectionTitle>
          <div className="space-y-3">
            <SettingCard>
              <SettingRow label="自动检测" desc="扫描系统中已安装的 Java（JAVA_HOME / PATH / 常见安装目录）">
                <Button size="sm" variant="outline" onPress={handleScan} isDisabled={scanning}>
                  {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  {scanning ? "检测中..." : "检测"}
                </Button>
              </SettingRow>
            </SettingCard>

            {scanning && (
              <SettingCard>
                <div className="space-y-2">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full rounded-lg" />
                  ))}
                </div>
              </SettingCard>
            )}

            {!scanning && javaList.length > 0 && (
              <SettingCard>
                <div className="space-y-2">
                  <p className="text-[12px] text-muted-foreground/70">检测结果（点击「使用」选择）</p>
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
                          onPress={() => setJava({ javaPath: j.path })}
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

            <SettingCard>
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">手动指定路径</p>
                <p className="text-[13px] text-muted-foreground">
                  指向 javaw.exe / java.exe 完整路径，输入后自动校验
                  {validating && "（校验中...）"}
                </p>
                <SettingFilePicker
                  label=""
                  value={java.javaPath}
                  onChange={(v) => setJava({ javaPath: v })}
                  placeholder="例如 C:\Program Files\Java\jdk-21\bin\javaw.exe"
                  mode="file"
                  filters={[{ name: "Java 可执行文件", extensions: ["exe"] }]}
                  showCheck={!!validated}
                />
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
          </div>
        </div>

        {/* 内存分配 */}
        <div>
          <SectionTitle>内存分配</SectionTitle>
          <div className="space-y-3">
            <SettingCard>
              <div className="space-y-3">
                <SettingRadioGroup
                  value={java.memMode}
                  options={[
                    { value: "auto", label: "自动配置" },
                    { value: "custom", label: "自定义" },
                  ]}
                  onChange={(v) => setJava({ memMode: v })}
                  horizontal
                />
                {java.memMode === "custom" && (
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
                desc="每行一个参数，例如 -XX:+UseZGC；支持引号包裹含空格的值"
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
