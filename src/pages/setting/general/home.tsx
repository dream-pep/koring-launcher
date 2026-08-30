import {
  UserCircle,
  Gamepad2,
  Palette,
  Download,
  Globe,
  Cpu,
  Info,
  ChevronRight,
} from "lucide-react";
import { VersionCard } from "@/components/VersionCard";
import { Surface, PageHeader, SectionTitle } from "@/components/setting";

interface ShortcutItem {
  icon: React.ReactNode;
  label: string;
  desc: string;
  navKey: string;
}

function ShortcutTile({ icon, label, desc, navKey, onClick }: ShortcutItem & { onClick: (key: string) => void }) {
  return (
    <button
      onClick={() => onClick(navKey)}
      className="w-full flex items-center gap-3 px-3.5 py-3 text-left rounded-lg transition-colors duration-150 hover:bg-foreground/5 dark:hover:bg-white/5 group"
    >
      <span className="flex items-center justify-center w-8 h-8 rounded-md bg-foreground/[0.06] dark:bg-white/[0.08] text-foreground/55 group-hover:text-foreground/80 shrink-0 transition-colors">
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-foreground truncate">{label}</p>
        <p className="text-[11.5px] text-muted-foreground truncate mt-0.5">{desc}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-foreground/20 shrink-0" />
    </button>
  );
}

const shortcuts: ShortcutItem[] = [
  { icon: <UserCircle className="w-4 h-4" />, label: "Koring 账户", desc: "同步数据、皮肤与个人配置", navKey: "account" },
  { icon: <Gamepad2 className="w-4 h-4" />, label: "游戏账户与档案", desc: "管理游戏内账户和档案配置", navKey: "game-account" },
  { icon: <Palette className="w-4 h-4" />, label: "主题与背景", desc: "深色模式、背景图片与视差", navKey: "theme-bg" },
  { icon: <Download className="w-4 h-4" />, label: "下载设置", desc: "下载线程数与存储路径", navKey: "download" },
  { icon: <Globe className="w-4 h-4" />, label: "联机功能", desc: "以太联机与陶瓦联机", navKey: "ether-online" },
  { icon: <Cpu className="w-4 h-4" />, label: "Java 虚拟机与内存", desc: "Java 路径与内存分配", navKey: "java-mem" },
  { icon: <Info className="w-4 h-4" />, label: "关于 Koring Launcher", desc: "版本信息与更新", navKey: "about" },
];

interface HomeSettingProps {
  onNavigate: (key: string) => void;
}

export function HomeSetting({ onNavigate }: HomeSettingProps) {
  return (
    <div>
      <PageHeader title="主页" desc="版本信息与常用设置的快捷入口" />

      <div className="space-y-6">
        {/* 与"关于"页使用相同的版本卡片；设置页整卡可点击跳转更新页 */}
        <VersionCard isSettingPage />

        <div>
          <SectionTitle>常用设置</SectionTitle>
          <Surface padding="sm">
            <div className="divide-y divide-border/30 dark:divide-white/[0.04]">
              {shortcuts.map((s) => (
                <ShortcutTile key={s.navKey} {...s} onClick={onNavigate} />
              ))}
            </div>
          </Surface>
        </div>
      </div>
    </div>
  );
}
