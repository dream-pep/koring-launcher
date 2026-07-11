import { VersionCard } from "@/components/VersionCard";
import { BUILD_MODE } from "@/lib/mode";
import { ExternalLink, GitFork } from "lucide-react";

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

const modeLabels: Record<string, string> = {
  dev: "开发版",
  beta: "测试版",
  run: "正式版",
};

const GITHUB_URL = "https://github.com/koring-launcher/koring-launcher";
const OFFICIAL_URL = "https://koring.app";

export function AboutSetting() {
  const openLink = (url: string) => {
    window.electronAPI?.openExternal(url);
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-foreground mb-1">关于</h2>
      <p className="text-sm text-muted-foreground mb-6">查看版本信息、更新状态与项目相关链接</p>

      <div className="space-y-6">
        {/* 版本卡片 */}
        <VersionCard />

        {/* 项目信息 */}
        <div>
          <h3 className="text-lg font-bold text-foreground mb-3">项目信息</h3>
          <div className="space-y-3">
            <GlassCard>
              <SettingRow label="应用名称" desc="Koring Launcher">
                <span className="text-[13px] text-muted-foreground">Lingke Network 提供技术支持</span>
              </SettingRow>
            </GlassCard>
            <GlassCard>
              <SettingRow label="构建模式">
                <span className="text-[13px] text-muted-foreground">{modeLabels[BUILD_MODE] ?? BUILD_MODE}</span>
              </SettingRow>
            </GlassCard>
            <GlassCard>
              <SettingRow label="技术栈" desc="Electron + React 19 + TypeScript + @xmcl">
                <span className="text-[13px] text-muted-foreground">Node.js</span>
              </SettingRow>
            </GlassCard>
          </div>
        </div>

        {/* 链接 */}
        <div>
          <h3 className="text-lg font-bold text-foreground mb-3">相关链接</h3>
          <div className="space-y-3">
            <GlassCard>
              <SettingRow label="GitHub 仓库" desc="查看源代码、提交 Issue">
                <button
                  onClick={() => openLink(GITHUB_URL)}
                  className="inline-flex items-center gap-1.5 text-[13px] text-primary hover:underline"
                >
                  <GitFork className="w-4 h-4" />
                  打开
                  <ExternalLink className="w-3 h-3" />
                </button>
              </SettingRow>
            </GlassCard>
            <GlassCard>
              <SettingRow label="官方网站" desc="了解更多功能与文档">
                <button
                  onClick={() => openLink(OFFICIAL_URL)}
                  className="inline-flex items-center gap-1.5 text-[13px] text-primary hover:underline"
                >
                  访问
                  <ExternalLink className="w-3 h-3" />
                </button>
              </SettingRow>
            </GlassCard>
          </div>
        </div>
      </div>
    </div>
  );
}
