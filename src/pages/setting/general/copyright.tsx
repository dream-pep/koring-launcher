import { ExternalLink } from "lucide-react";
import { Link } from "@heroui/react";
import { SettingCard, SettingRow, PageHeader, SectionTitle } from "@/components/setting";

const openLink = (url: string) => {
  window.electronAPI?.openExternal(url);
};

const licenses = [
  { name: "Electron", license: "MIT", url: "https://github.com/electron/electron" },
  { name: "React", license: "MIT", url: "https://github.com/facebook/react" },
  { name: "@xmcl/core", license: "MIT", url: "https://github.com/VoxelCogs/xmcl" },
  { name: "@xmcl/installer", license: "MIT", url: "https://github.com/VoxelCogs/xmcl" },
  { name: "@xmcl/user", license: "MIT", url: "https://github.com/VoxelCogs/xmcl" },
  { name: "Zustand", license: "MIT", url: "https://github.com/pmndrs/zustand" },
  { name: "Tailwind CSS", license: "MIT", url: "https://github.com/tailwindlabs/tailwindcss" },
  { name: "HeroUI", license: "MIT", url: "https://github.com/heroui-inc/heroui" },
  { name: "Vite", license: "MIT", url: "https://github.com/vitejs/vite" },
  { name: "Lucide React", license: "ISC", url: "https://github.com/lucide-icons/lucide" },
];

const fonts = [
  { name: "Alimama ShuHeiTi", license: "商用免费授权", note: "主标题字体" },
  { name: "Geist", license: "OFL-1.1", note: "界面字体" },
  { name: "Inter", license: "OFL-1.1", note: "界面字体" },
];

export function CopyrightSetting() {
  return (
    <div>
      <PageHeader title="版权" desc="开源协议、依赖项目授权与字体版权信息" />

      <div className="space-y-6">
        <div>
          <SectionTitle>项目协议</SectionTitle>
          <SettingCard>
            <SettingRow label="LL-1.0 (LingkeLice 1.0)" desc="Copyright © Shenzhen Lingke Network Technology Co., Ltd.">
              <Link onPress={() => openLink("https://support.lingke.ink/LL-1.0")}>
                查看
                <ExternalLink className="w-3 h-3" />
              </Link>
            </SettingRow>
          </SettingCard>
        </div>

        <div>
          <SectionTitle>开源依赖</SectionTitle>
          <div className="space-y-2">
            {licenses.map((dep) => (
              <SettingCard key={dep.name}>
                <SettingRow label={dep.name} desc={dep.license}>
                  <Link onPress={() => openLink(dep.url)}>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </SettingRow>
              </SettingCard>
            ))}
          </div>
        </div>

        <div>
          <SectionTitle>字体授权</SectionTitle>
          <div className="space-y-2">
            {fonts.map((font) => (
              <SettingCard key={font.name}>
                <SettingRow label={font.name} desc={font.license}>
                  <span className="text-[12px] text-muted-foreground">{font.note}</span>
                </SettingRow>
              </SettingCard>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
