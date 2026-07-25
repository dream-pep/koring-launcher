import { useConfigStore } from "@/stores/configStore";
import { Button, Slider, RadioGroup, Radio, Input, TextArea } from "@heroui/react";
import { Cpu, FolderSearch } from "lucide-react";
import { SettingCard, SettingRow, PageHeader, SectionTitle } from "@/components/setting";

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
      <PageHeader title="Java 虚拟机与内存" desc="配置 Java 运行环境路径、JVM 参数与游戏内存分配" />

      <div className="space-y-6">
        <div>
          <SectionTitle>Java 环境</SectionTitle>
          <div className="space-y-3">
            <SettingCard>
              <SettingRow label="自动检测" desc="扫描系统中已安装的 Java 版本">
                <Button size="sm" variant="outline">
                  <FolderSearch className="w-3.5 h-3.5 mr-1.5" />
                  检测
                </Button>
              </SettingRow>
            </SettingCard>

            {mockJavaList.map((j) => (
              <SettingCard key={j.path}>
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
                  <Button size="sm" variant="outline" className="shrink-0" onPress={() => setJava({ javaPath: j.path })}>
                    使用
                  </Button>
                </div>
              </SettingCard>
            ))}

            <SettingCard>
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">手动指定路径</p>
                <div className="flex items-center gap-2">
                  <Input
                    value={java.javaPath}
                    onChange={(e) => setJava({ javaPath: e.target.value })}
                    placeholder="输入 javaw.exe 完整路径"
                    fullWidth
                  />
                  <Button size="sm" variant="outline">浏览</Button>
                </div>
              </div>
            </SettingCard>
          </div>
        </div>

        <div>
          <SectionTitle>内存分配</SectionTitle>
          <div className="space-y-3">
            <SettingCard>
              <div className="space-y-3">
                <RadioGroup
                  value={java.memMode}
                  onValueChange={(v) => setJava({ memMode: v })}
                  className="flex items-center gap-4"
                >
                  <Radio value="auto">
                    <Radio.Content>自动配置</Radio.Content>
                  </Radio>
                  <Radio value="custom">
                    <Radio.Content>自定义</Radio.Content>
                  </Radio>
                </RadioGroup>
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

        <div>
          <SectionTitle>JVM 参数</SectionTitle>
          <div className="space-y-3">
            <SettingCard>
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">额外 JVM 启动参数</p>
                <p className="text-[13px] text-muted-foreground">每行一个参数，例如 -XX:+UseZGC</p>
                <TextArea
                  value={java.jvmArgs}
                  onChange={(e) => setJava({ jvmArgs: e.target.value })}
                  placeholder="可选，留空使用默认参数"
                  rows={3}
                  fullWidth
                />
              </div>
            </SettingCard>
          </div>
        </div>

        <div>
          <SectionTitle>垃圾回收</SectionTitle>
          <div className="space-y-3">
            <SettingCard>
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">GC 算法</p>
                <RadioGroup
                  value={java.gc}
                  onValueChange={(v) => setJava({ gc: v })}
                  className="space-y-2"
                >
                  {gcOptions.map((opt) => (
                    <Radio key={opt.value} value={opt.value}>
                      <Radio.Content>{opt.label}</Radio.Content>
                    </Radio>
                  ))}
                </RadioGroup>
              </div>
            </SettingCard>
          </div>
        </div>
      </div>
    </div>
  );
}
