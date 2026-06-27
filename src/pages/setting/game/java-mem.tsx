import { useConfigStore } from "@/stores/configStore";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Cpu, FolderSearch } from "lucide-react";

function GlassCard({ children }: { children: React.ReactNode }) {
  return <div className="glass-card px-5 py-4">{children}</div>;
}

function SettingRow({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {desc && <p className="text-[13px] text-muted-foreground mt-0.5">{desc}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

interface JavaInfo {
  path: string;
  version: string;
  vendor: string;
}

const mockJavaList: JavaInfo[] = [
  { path: "C:\\Program Files\\Java\\jdk-21\\bin\\javaw.exe", version: "21.0.3", vendor: "Oracle OpenJDK" },
  { path: "C:\\Program Files\\Eclipse Adoptium\\jdk-17.0.10.7-hotspot\\bin\\javaw.exe", version: "17.0.10", vendor: "Eclipse Temurin" },
];

const gcOptions = [
  { value: "auto", label: "不指定（由 Java 自动选择）" },
  { value: "zgc", label: "ZGC（低延迟，推荐 Java 21+）" },
  { value: "g1", label: "G1GC（标准，兼容性好）" },
];

export function JavaMemSetting() {
  const java = useConfigStore((s) => s.config.java);
  const setJava = useConfigStore((s) => s.setJava);

  return (
    <div>
      <h2 className="text-xl font-bold text-foreground mb-1">Java 虚拟机与内存</h2>
      <p className="text-sm text-muted-foreground mb-6">配置 Java 运行环境路径、JVM 参数与游戏内存分配</p>

      <div className="space-y-6">
        {/* ===== Java 环境 ===== */}
        <div>
          <h3 className="text-lg font-bold text-foreground mb-3">Java 环境</h3>
          <div className="space-y-3">
            <GlassCard>
              <SettingRow label="自动检测" desc="扫描系统中已安装的 Java 版本">
                <Button size="sm" variant="outline">
                  <FolderSearch className="w-3.5 h-3.5 mr-1.5" />
                  检测
                </Button>
              </SettingRow>
            </GlassCard>

            {mockJavaList.map((j) => (
              <GlassCard key={j.path}>
                <div className="flex items-center gap-3">
                  <Cpu className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {j.vendor} {j.version}
                    </p>
                    <p className="text-[11px] text-muted-foreground/60 mt-0.5 font-mono truncate">
                      {j.path}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" className="shrink-0" onClick={() => setJava({ javaPath: j.path })}>
                    使用
                  </Button>
                </div>
              </GlassCard>
            ))}

            <GlassCard>
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">手动指定路径</p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={java.javaPath}
                    onChange={(e) => setJava({ javaPath: e.target.value })}
                    placeholder="输入 javaw.exe 完整路径"
                    className="flex-1 h-8 px-3 rounded-md border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <Button size="sm" variant="outline">浏览</Button>
                </div>
              </div>
            </GlassCard>
          </div>
        </div>

        {/* ===== 内存分配 ===== */}
        <div>
          <h3 className="text-lg font-bold text-foreground mb-3">内存分配</h3>
          <div className="space-y-3">
            <GlassCard>
              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="mem" checked={java.memMode === "auto"} onChange={() => setJava({ memMode: "auto" })} className="accent-primary" />
                    <span className="text-sm text-foreground">自动配置</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="mem" checked={java.memMode === "custom"} onChange={() => setJava({ memMode: "custom" })} className="accent-primary" />
                    <span className="text-sm text-foreground">自定义</span>
                  </label>
                </div>
                {java.memMode === "custom" && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[13px] text-muted-foreground">分配内存</span>
                      <span className="text-[13px] text-muted-foreground tabular-nums">{java.memGB} GB</span>
                    </div>
                    <Slider
                      value={[java.memGB]}
                      onValueChange={(v) => setJava({ memGB: Array.isArray(v) ? v[0] : v })}
                      min={1}
                      max={16}
                      step={1}
                    />
                    <div className="flex justify-between mt-1">
                      <span className="text-[11px] text-muted-foreground/50">1 GB</span>
                      <span className="text-[11px] text-muted-foreground/50">16 GB</span>
                    </div>
                  </div>
                )}
              </div>
            </GlassCard>
          </div>
        </div>

        {/* ===== JVM 参数 ===== */}
        <div>
          <h3 className="text-lg font-bold text-foreground mb-3">JVM 参数</h3>
          <div className="space-y-3">
            <GlassCard>
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">额外 JVM 启动参数</p>
                <p className="text-[13px] text-muted-foreground">每行一个参数，例如 -XX:+UseZGC</p>
                <textarea
                  value={java.jvmArgs}
                  onChange={(e) => setJava({ jvmArgs: e.target.value })}
                  placeholder="可选，留空使用默认参数"
                  rows={3}
                  className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none font-mono"
                />
              </div>
            </GlassCard>
          </div>
        </div>

        {/* ===== 垃圾回收 ===== */}
        <div>
          <h3 className="text-lg font-bold text-foreground mb-3">垃圾回收</h3>
          <div className="space-y-3">
            <GlassCard>
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">GC 算法</p>
                <div className="space-y-2">
                  {gcOptions.map((opt) => (
                    <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="gc" checked={java.gc === opt.value} onChange={() => setJava({ gc: opt.value })} className="accent-primary" />
                      <span className="text-sm text-foreground">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </GlassCard>
          </div>
        </div>
      </div>
    </div>
  );
}
