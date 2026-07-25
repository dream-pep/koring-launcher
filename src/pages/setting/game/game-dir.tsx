import { useConfigStore } from "@/stores/configStore";
import { Button, Input } from "@heroui/react";
import { RefreshCw } from "lucide-react";
import { SettingCard, PageHeader, SectionTitle } from "@/components/setting";

function PathInput({ label, desc, value, onChange }: { label: string; desc: string; value: string; onChange: (v: string) => void }) {
  return (
    <SettingCard>
      <div className="space-y-2">
        <div>
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-[13px] text-muted-foreground mt-0.5">{desc}</p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            fullWidth
          />
          <Button size="sm" variant="outline">浏览</Button>
        </div>
      </div>
    </SettingCard>
  );
}

export function GameDirSetting() {
  const game = useConfigStore((s) => s.config.game);
  const setGame = useConfigStore((s) => s.setGame);

  return (
    <div>
      <PageHeader title="游戏目录" desc="设置 Minecraft 游戏安装路径、存档位置与资源包目录" />

      <div className="space-y-6">
        <div>
          <SectionTitle>游戏路径</SectionTitle>
          <div className="space-y-3">
            <PathInput
              label="游戏安装根目录"
              desc="Minecraft 游戏文件的根目录，包含 versions、saves、resourcepacks 等文件夹"
              value={game.gameDir}
              onChange={(v) => setGame({ gameDir: v })}
            />
            <SettingCard>
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
            </SettingCard>
          </div>
        </div>

        <div>
          <SectionTitle>资源包目录</SectionTitle>
          <div className="space-y-3">
            <PathInput
              label="资源包路径"
              desc="自定义资源包（材质包）的存放目录，留空使用默认路径"
              value={game.resourceDir}
              onChange={(v) => setGame({ resourceDir: v })}
            />
          </div>
        </div>

        <div>
          <SectionTitle>存档目录</SectionTitle>
          <div className="space-y-3">
            <PathInput
              label="存档路径"
              desc="自定义世界存档的存放目录，留空使用默认路径"
              value={game.savesDir}
              onChange={(v) => setGame({ savesDir: v })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
