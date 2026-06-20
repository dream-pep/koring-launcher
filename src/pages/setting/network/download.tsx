import { useState } from "react";
import { Slider } from "@/components/ui/slider";

function GlassCard({ children }: { children: React.ReactNode }) {
  return <div className="glass-card px-5 py-4">{children}</div>;
}

const downloadSources = [
  { value: "mirror", label: "尽量使用镜像源（推荐国内用户）" },
  { value: "official", label: "优先使用官方源" },
  { value: "official-only", label: "仅使用官方源" },
];

export function DownloadSetting() {
  const [fileSource, setFileSource] = useState("mirror");
  const [versionSource, setVersionSource] = useState("mirror");
  const [threads, setThreads] = useState(16);
  const [speedLimit, setSpeedLimit] = useState("0");

  return (
    <div>
      <h2 className="text-xl font-bold text-foreground mb-1">下载</h2>
      <p className="text-sm text-muted-foreground mb-6">配置游戏资源下载源、并发数与存储路径</p>

      <div className="space-y-6">
        {/* ===== 下载源 ===== */}
        <div>
          <h3 className="text-lg font-bold text-foreground mb-3">下载源</h3>
          <div className="space-y-3">
            <GlassCard>
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">文件下载源</p>
                <p className="text-[13px] text-muted-foreground">游戏文件（jar、lib）的下载来源</p>
                <div className="space-y-2 mt-2">
                  {downloadSources.map((opt) => (
                    <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="fileSource" checked={fileSource === opt.value} onChange={() => setFileSource(opt.value)} className="accent-primary" />
                      <span className="text-sm text-foreground">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </GlassCard>

            <GlassCard>
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">版本列表源</p>
                <p className="text-[13px] text-muted-foreground">获取可用游戏版本列表的来源</p>
                <div className="space-y-2 mt-2">
                  {downloadSources.map((opt) => (
                    <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="versionSource" checked={versionSource === opt.value} onChange={() => setVersionSource(opt.value)} className="accent-primary" />
                      <span className="text-sm text-foreground">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </GlassCard>
          </div>
        </div>

        {/* ===== 并发控制 ===== */}
        <div>
          <h3 className="text-lg font-bold text-foreground mb-3">并发控制</h3>
          <div className="space-y-3">
            <GlassCard>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">最大下载线程数</p>
                    <p className="text-[13px] text-muted-foreground mt-0.5">同时下载的文件数量，过高可能导致不稳定</p>
                  </div>
                  <span className="text-[13px] text-muted-foreground tabular-nums shrink-0 ml-4">{threads}</span>
                </div>
                <Slider
                  value={[threads]}
                  onValueChange={(v) => setThreads(Array.isArray(v) ? v[0] : v)}
                  min={1}
                  max={64}
                  step={1}
                />
                <div className="flex justify-between mt-1">
                  <span className="text-[11px] text-muted-foreground/50">1</span>
                  <span className="text-[11px] text-muted-foreground/50">64</span>
                </div>
              </div>
            </GlassCard>
          </div>
        </div>

        {/* ===== 速度限制 ===== */}
        <div>
          <h3 className="text-lg font-bold text-foreground mb-3">速度限制</h3>
          <div className="space-y-3">
            <GlassCard>
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">下载速度上限</p>
                <p className="text-[13px] text-muted-foreground">单位 KB/s，0 表示不限速</p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={speedLimit}
                    onChange={(e) => setSpeedLimit(e.target.value)}
                    min={0}
                    className="w-28 h-8 px-3 rounded-md border border-input bg-background text-sm font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <span className="text-[13px] text-muted-foreground">KB/s</span>
                </div>
              </div>
            </GlassCard>
          </div>
        </div>
      </div>
    </div>
  );
}
