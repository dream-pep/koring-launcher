import { useKoringAuthStore } from "@/stores/koringAuthStore";
import { BUILD_MODE } from "@/lib/mode";
import { useUpdateStore } from "@/stores/updateStore";
import {
  UserCircle,
  Gamepad2,
  Palette,
  Download,
  Globe,
  Cpu,
  Info,
  ChevronRight,
  Search,
} from "lucide-react";
import { Avatar } from "@heroui/react";
import { SettingCard, PageHeader, SectionTitle } from "@/components/setting";

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
      className="glass-card flex items-center gap-3.5 px-4 py-3.5 text-left transition-all duration-150 hover:bg-foreground/[0.04] group"
    >
      <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-foreground/[0.06] text-foreground/60 group-hover:text-foreground/80 shrink-0">
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{label}</p>
        <p className="text-[12px] text-muted-foreground truncate">{desc}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-foreground/25 shrink-0" />
    </button>
  );
}

const modeLabels: Record<string, string> = {
  dev: "开发版",
  beta: "测试版",
  run: "正式版",
};

const shortcuts: ShortcutItem[] = [
  { icon: <UserCircle className="w-[18px] h-[18px]" />, label: "Koring 账户", desc: "同步数据、皮肤与个人配置", navKey: "account" },
  { icon: <Gamepad2 className="w-[18px] h-[18px]" />, label: "游戏账户与档案", desc: "管理游戏内账户和档案配置", navKey: "game-account" },
  { icon: <Palette className="w-[18px] h-[18px]" />, label: "主题与背景", desc: "深色模式、背景图片与视差", navKey: "theme-bg" },
  { icon: <Download className="w-[18px] h-[18px]" />, label: "下载设置", desc: "下载线程数与存储路径", navKey: "download" },
  { icon: <Globe className="w-[18px] h-[18px]" />, label: "联机功能", desc: "以太联机与陶瓦联机", navKey: "ether-online" },
  { icon: <Cpu className="w-[18px] h-[18px]" />, label: "Java 虚拟机与内存", desc: "Java 路径与内存分配", navKey: "java-mem" },
  { icon: <Info className="w-[18px] h-[18px]" />, label: "关于 Koring Launcher", desc: "版本信息与更新", navKey: "about" },
];

interface HomeSettingProps {
  onNavigate: (key: string) => void;
}

export function HomeSetting({ onNavigate }: HomeSettingProps) {
  const user = useKoringAuthStore((s) => s.user);
  const { update } = useUpdateStore();

  return (
    <div>
      <PageHeader title="主页" desc="自定义启动器主页的显示内容与常用设置的快捷入口" />

      <div className="space-y-6">
        <SettingCard className="flex items-center gap-3 px-4 py-3">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-sm text-muted-foreground">查找设置</span>
        </SettingCard>

        <div>
          <SectionTitle>快速概览</SectionTitle>
          <SettingCard>
            <div className="flex items-center gap-4">
              <Avatar size="lg">
                {user?.picture ? (
                  <Avatar.Image src={user.picture} alt="" />
                ) : (
                  <Avatar.Fallback>
                    <UserCircle className="w-7 h-7 text-foreground/40" />
                  </Avatar.Fallback>
                )}
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {user ? (user.name || user.username) : "未登录"}
                </p>
                <p className="text-[12px] text-muted-foreground mt-0.5">
                  {user ? "Koring 账户" : "登录以同步数据和皮肤"}
                </p>
              </div>
              <span className="text-[11px] text-muted-foreground shrink-0">
                {modeLabels[BUILD_MODE] ?? BUILD_MODE}
                {update ? " · 有更新" : ""}
              </span>
            </div>
          </SettingCard>
        </div>

        <div>
          <SectionTitle>常用设置</SectionTitle>
          <div className="grid grid-cols-1 gap-2">
            {shortcuts.map((s) => (
              <ShortcutTile key={s.navKey} {...s} onClick={onNavigate} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
