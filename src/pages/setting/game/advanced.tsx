import { useState } from "react";
import { Switch } from "@/components/ui/switch";

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

const launcherBehavior = [
  { value: "close", label: "关闭启动器" },
  { value: "minimize", label: "最小化到任务栏" },
  { value: "keep", label: "保持不变" },
];

const windowSize = [
  { value: "default", label: "默认窗口大小" },
  { value: "fullscreen", label: "全屏启动" },
  { value: "custom", label: "自定义尺寸" },
];

export function AdvancedSetting() {
  const [afterLaunch, setAfterLaunch] = useState("close");
  const [winMode, setWinMode] = useState("default");
  const [customWidth, setCustomWidth] = useState("854");
  const [customHeight, setCustomHeight] = useState("480");
  const [gameArgs, setGameArgs] = useState("");
  const [preLaunchCmd, setPreLaunchCmd] = useState("");
  const [debugMode, setDebugMode] = useState(false);

  return (
    <div>
      <h2 className="text-xl font-bold text-foreground mb-1">高级设置</h2>
      <p className="text-sm text-muted-foreground mb-6">游戏高级启动参数、调试选项与实验性功能</p>

      <div className="space-y-6">
        {/* ===== 启动行为 ===== */}
        <div>
          <h3 className="text-lg font-bold text-foreground mb-3">启动行为</h3>
          <div className="space-y-3">
            <GlassCard>
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">启动后启动器行为</p>
                <p className="text-[13px] text-muted-foreground">游戏启动后启动器的处理方式</p>
                <div className="space-y-2 mt-2">
                  {launcherBehavior.map((opt) => (
                    <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="afterLaunch" checked={afterLaunch === opt.value} onChange={() => setAfterLaunch(opt.value)} className="accent-primary" />
                      <span className="text-sm text-foreground">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </GlassCard>
          </div>
        </div>

        {/* ===== 窗口设置 ===== */}
        <div>
          <h3 className="text-lg font-bold text-foreground mb-3">窗口设置</h3>
          <div className="space-y-3">
            <GlassCard>
              <div className="space-y-3">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">窗口大小</p>
                  <div className="space-y-2">
                    {windowSize.map((opt) => (
                      <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="winMode" checked={winMode === opt.value} onChange={() => setWinMode(opt.value)} className="accent-primary" />
                        <span className="text-sm text-foreground">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                {winMode === "custom" && (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] text-muted-foreground">宽</span>
                      <input
                        type="number"
                        value={customWidth}
                        onChange={(e) => setCustomWidth(e.target.value)}
                        className="w-20 h-8 px-2 rounded-md border border-input bg-background text-sm text-center font-mono focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                    <span className="text-muted-foreground">×</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] text-muted-foreground">高</span>
                      <input
                        type="number"
                        value={customHeight}
                        onChange={(e) => setCustomHeight(e.target.value)}
                        className="w-20 h-8 px-2 rounded-md border border-input bg-background text-sm text-center font-mono focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                  </div>
                )}
              </div>
            </GlassCard>
          </div>
        </div>

        {/* ===== 游戏参数 ===== */}
        <div>
          <h3 className="text-lg font-bold text-foreground mb-3">游戏参数</h3>
          <div className="space-y-3">
            <GlassCard>
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">额外游戏启动参数</p>
                <p className="text-[13px] text-muted-foreground">附加到游戏启动命令末尾的参数</p>
                <input
                  type="text"
                  value={gameArgs}
                  onChange={(e) => setGameArgs(e.target.value)}
                  placeholder="可选，例如 --demo"
                  className="w-full h-8 px-3 rounded-md border border-input bg-background text-sm font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </GlassCard>
          </div>
        </div>

        {/* ===== 启动命令 ===== */}
        <div>
          <h3 className="text-lg font-bold text-foreground mb-3">启动命令</h3>
          <div className="space-y-3">
            <GlassCard>
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">启动前执行命令</p>
                <p className="text-[13px] text-muted-foreground">游戏启动前自动执行的命令或程序路径</p>
                <input
                  type="text"
                  value={preLaunchCmd}
                  onChange={(e) => setPreLaunchCmd(e.target.value)}
                  placeholder="可选，例如 D:\scripts\pre-launch.bat"
                  className="w-full h-8 px-3 rounded-md border border-input bg-background text-sm font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </GlassCard>
          </div>
        </div>

        {/* ===== 调试 ===== */}
        <div>
          <h3 className="text-lg font-bold text-foreground mb-3">调试</h3>
          <div className="space-y-3">
            <GlassCard>
              <SettingRow label="调试模式" desc="启用后将在控制台输出详细日志，可能影响性能">
                <Switch checked={debugMode} onCheckedChange={setDebugMode} />
              </SettingRow>
            </GlassCard>
          </div>
        </div>
      </div>
    </div>
  );
}
