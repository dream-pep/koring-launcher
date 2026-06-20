import { ExternalLink } from "lucide-react";
import { open } from "@tauri-apps/plugin-shell";

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

const openLink = (url: string) => {
  open(url).catch(() => {
    window.open(url, "_blank");
  });
};

const licenses = [
  { name: "Tauri", license: "MIT / Apache-2.0", url: "https://github.com/tauri-apps/tauri" },
  { name: "React", license: "MIT", url: "https://github.com/facebook/react" },
  { name: "@xmcl/core", license: "MIT", url: "https://github.com/VoxelCogs/xmcl" },
  { name: "@xmcl/installer", license: "MIT", url: "https://github.com/VoxelCogs/xmcl" },
  { name: "@xmcl/user", license: "MIT", url: "https://github.com/VoxelCogs/xmcl" },
  { name: "Zustand", license: "MIT", url: "https://github.com/pmndrs/zustand" },
  { name: "Tailwind CSS", license: "MIT", url: "https://github.com/tailwindlabs/tailwindcss" },
  { name: "shadcn/ui", license: "MIT", url: "https://github.com/shadcn-ui/ui" },
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
      <h2 className="text-xl font-bold text-foreground mb-1">版权</h2>
      <p className="text-sm text-muted-foreground mb-6">开源协议、依赖项目授权与字体版权信息</p>

      <div className="space-y-6">
        {/* 项目协议 */}
        <div>
          <h3 className="text-lg font-bold text-foreground mb-3">项目协议</h3>
          <GlassCard>
            <SettingRow label="MIT License" desc="Copyright © 2024 Koring Launcher Contributors">
              <button
                onClick={() => openLink("https://opensource.org/licenses/MIT")}
                className="inline-flex items-center gap-1.5 text-[13px] text-primary hover:underline"
              >
                查看
                <ExternalLink className="w-3 h-3" />
              </button>
            </SettingRow>
          </GlassCard>
        </div>

        {/* 开源依赖 */}
        <div>
          <h3 className="text-lg font-bold text-foreground mb-3">开源依赖</h3>
          <div className="space-y-2">
            {licenses.map((dep) => (
              <GlassCard key={dep.name}>
                <SettingRow label={dep.name} desc={dep.license}>
                  <button
                    onClick={() => openLink(dep.url)}
                    className="inline-flex items-center gap-1 text-[13px] text-primary hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </SettingRow>
              </GlassCard>
            ))}
          </div>
        </div>

        {/* 字体 */}
        <div>
          <h3 className="text-lg font-bold text-foreground mb-3">字体授权</h3>
          <div className="space-y-2">
            {fonts.map((font) => (
              <GlassCard key={font.name}>
                <SettingRow label={font.name} desc={font.license}>
                  <span className="text-[12px] text-muted-foreground">{font.note}</span>
                </SettingRow>
              </GlassCard>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
