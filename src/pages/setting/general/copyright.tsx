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
          <SectionTitle>法律信息</SectionTitle>
          <div className="space-y-2">
            <SettingCard>
              <SettingRow label="匿名数据收集" desc="您在使用本产品时，可能会收集匿名数据，用于改进产品功能和用户体验。包括崩溃日志、崩溃操作路径与设备状态等脱敏信息。并上传至 Lenjing.Cloud 服务器。">
                <Link>
                </Link>
              </SettingRow>
              <SettingRow label="隐私声明与个人信息保护策略" desc="本产品在现有版本下暂未进行收集任何隐私信息与个人信息。">
                <Link>
                </Link>
              </SettingRow>
              <SettingRow label="其他信息" desc="Copyright © 深圳棱镜视界科技有限公司。
              违法违规行为举报信箱：support@lenjing.email">
                <Link>
                </Link>
              </SettingRow>
            </SettingCard>
            <SettingCard>
              <SettingRow label="用户协议与免责声明" desc="Copyright © Shenzhen Prism Horizon Technology Co., Ltd.">
                <Link onPress={() => openLink("https://support.lingke.ink/Koring/系列产品用户协议与免责声明")}>
                  查看
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </SettingRow>
            </SettingCard>
            <SettingCard>
              <SettingRow label="产品分发有限许可" desc="除本许可明确授予的权利外，许可方保留软件及其相关知识产权中的全部权利。">
                <Link onPress={() => openLink("https://support.lingke.ink/Koring/系列产品分发有限许可")}>
                  查看
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </SettingRow>
            </SettingCard>
          </div>
        </div>

        <div>
          <SectionTitle>项目代码开源协议</SectionTitle>
          <SettingCard>
            <SettingRow label="开源协议 LL-1.0 (LingkeLice 1.0)" desc="开源协议使用 Shenzhen Lingke Network Technology Co., Ltd. 发布的LL-1.0协议">
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
