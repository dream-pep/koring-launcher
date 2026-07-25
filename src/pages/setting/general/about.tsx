import { VersionCard } from "@/components/VersionCard";
import { BUILD_MODE } from "@/lib/mode";
import { ExternalLink, GitFork, RotateCcw } from "lucide-react";
import { useConfirmDialogStore } from "@/stores/confirmDialogStore";
import { Button, Link } from "@heroui/react";
import { SettingCard, SettingRow, PageHeader, SectionTitle } from "@/components/setting";

const modeLabels: Record<string, string> = {
  dev: "开发版",
  beta: "测试版",
  run: "正式版",
};

const GITHUB_URL = "https://github.com/koring-launcher/koring-launcher";
const OFFICIAL_URL = "https://koring.app";

export function AboutSetting() {
  const openDialog = useConfirmDialogStore((s) => s.openDialog);

  const openLink = (url: string) => {
    window.electronAPI?.openExternal(url);
  };

  const handleResetClick = () => {
    openDialog({
      title: "您确定要还原所有配置吗？",
      description: "您还原后，您的实例将会保留，但是所有个性化配置将全部丢失，并且需要重新进行激活",
      confirmLabel: "确认还原",
      countdown: 5,
      onConfirm: () => window.electronAPI?.resetConfig(),
    });
  };

  return (
    <div>
      <PageHeader title="关于" desc="查看版本信息、更新状态与项目相关链接" />

      <div className="space-y-6">
        <VersionCard />

        <div>
          <SectionTitle>项目信息</SectionTitle>
          <div className="space-y-3">
            <SettingCard>
              <SettingRow label="应用名称" desc="Koring Launcher">
                <span className="text-[13px] text-muted-foreground">Lingke Network 提供技术支持</span>
              </SettingRow>
            </SettingCard>
            <SettingCard>
              <SettingRow label="构建模式">
                <span className="text-[13px] text-muted-foreground">{modeLabels[BUILD_MODE] ?? BUILD_MODE}</span>
              </SettingRow>
            </SettingCard>
            <SettingCard>
              <SettingRow label="技术栈" desc="Electron + React 19 + TypeScript + @xmcl">
                <span className="text-[13px] text-muted-foreground">Node.js</span>
              </SettingRow>
            </SettingCard>
          </div>
        </div>

        <div>
          <SectionTitle>相关链接</SectionTitle>
          <div className="space-y-3">
            <SettingCard>
              <SettingRow label="GitHub 仓库" desc="查看源代码、提交 Issue">
                <Link onPress={() => openLink(GITHUB_URL)}>
                  <GitFork className="w-4 h-4" />
                  打开
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </SettingRow>
            </SettingCard>
            <SettingCard>
              <SettingRow label="官方网站" desc="了解更多功能与文档">
                <Link onPress={() => openLink(OFFICIAL_URL)}>
                  访问
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </SettingRow>
            </SettingCard>
          </div>
        </div>

        <div>
          <SectionTitle>危险操作</SectionTitle>
          <SettingCard>
            <SettingRow label="还原所有设置" desc="删除所有配置文件并重启应用">
              <Button variant="danger" size="sm" onPress={handleResetClick}>
                <RotateCcw className="w-4 h-4" />
                还原
              </Button>
            </SettingRow>
          </SettingCard>
        </div>
      </div>
    </div>
  );
}
