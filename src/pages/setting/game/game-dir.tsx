import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

function GlassCard({ children }: { children: React.ReactNode }) {
  return <div className="glass-card px-5 py-4">{children}</div>;
}

function PathInput({ label, desc, value, onChange }: { label: string; desc: string; value: string; onChange: (v: string) => void }) {
  return (
    <GlassCard>
      <div className="space-y-2">
        <div>
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-[13px] text-muted-foreground mt-0.5">{desc}</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="flex-1 h-8 px-3 rounded-md border border-input bg-background text-sm font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <Button size="sm" variant="outline">浏览</Button>
        </div>
      </div>
    </GlassCard>
  );
}

export function GameDirSetting() {
  const [gameDir, setGameDir] = useState(".minecraft");
  const [resourceDir, setResourceDir] = useState("");
  const [savesDir, setSavesDir] = useState("");

  return (
    <div>
      <h2 className="text-xl font-bold text-foreground mb-1">游戏目录</h2>
      <p className="text-sm text-muted-foreground mb-6">设置 Minecraft 游戏安装路径、存档位置与资源包目录</p>

      <div className="space-y-6">
        {/* ===== 游戏路径 ===== */}
        <div>
          <h3 className="text-lg font-bold text-foreground mb-3">游戏路径</h3>
          <div className="space-y-3">
            <PathInput
              label="游戏安装根目录"
              desc="Minecraft 游戏文件的根目录，包含 versions、saves、resourcepacks 等文件夹"
              value={gameDir}
              onChange={setGameDir}
            />
            <GlassCard>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">已安装版本</p>
                  <p className="text-[13px] text-muted-foreground mt-0.5">扫描当前目录下的游戏版本</p>
                </div>
                <Button size="sm" variant="outline">
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                  扫描
                </Button>
              </div>
            </GlassCard>
          </div>
        </div>

        {/* ===== 资源包 ===== */}
        <div>
          <h3 className="text-lg font-bold text-foreground mb-3">资源包目录</h3>
          <div className="space-y-3">
            <PathInput
              label="资源包路径"
              desc="自定义资源包（材质包）的存放目录，留空使用默认路径"
              value={resourceDir}
              onChange={setResourceDir}
            />
          </div>
        </div>

        {/* ===== 存档 ===== */}
        <div>
          <h3 className="text-lg font-bold text-foreground mb-3">存档目录</h3>
          <div className="space-y-3">
            <PathInput
              label="存档路径"
              desc="自定义世界存档的存放目录，留空使用默认路径"
              value={savesDir}
              onChange={setSavesDir}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
