import { useState, useCallback, type ReactNode } from "react";
import {
  Home,
  Info,
  Copyright,
  Gamepad2,
  Cpu,
  FolderOpen,
  Settings,
  Palette,
  Monitor,
  Languages,
  Accessibility,
  Download,
  Globe,
  Network,
  Shield,
  MessageSquareHeart,
  Heart,
  Code,
} from "lucide-react";
import { useRouteStore } from "@/stores/routeStore";

import { HomeSetting } from "./general/home";
// import { AccountSetting } from "./general/account";  // Koring 账户（暂时隐藏）
import { AboutSetting } from "./general/about";
import { CopyrightSetting } from "./general/copyright";
import { GameAccountSetting } from "./game/game-account";
import { JavaMemSetting } from "./game/java-mem";
import { GameDirSetting } from "./game/game-dir";
import { AdvancedSetting } from "./game/advanced";
import { ThemeBgSetting } from "./personalization/theme-bg";
import { UiSetting } from "./personalization/ui";
import { LangSetting } from "./personalization/lang";
import { A11ySetting } from "./personalization/a11y";
import { DownloadSetting } from "./network/download";
import { EtherOnlineSetting } from "./network/ether-online";
import { TawaOnlineSetting } from "./network/tawa-online";
import { SecurityIdSetting } from "./network/security-id";
import { FeedbackSetting } from "./other/feedback";
import { SponsorSetting } from "./other/sponsor";

interface MenuItem {
  key: string;
  label: string;
  icon: ReactNode;
  component?: ReactNode;
  onSelect?: () => void;
}

interface MenuGroup {
  title: string;
  items: MenuItem[];
}

const iconCls = "w-[18px] h-[18px] shrink-0";

function buildMenuData(
  switchPage: (key: string) => void,
  routeNavigate: (key: any) => void,
): MenuGroup[] {
  return [
    {
      title: "通用",
      items: [
        { key: "home", label: "主页", icon: <Home className={iconCls} />, component: <HomeSetting onNavigate={switchPage} /> },
        // Koring 账户（暂时隐藏）
        // { key: "account", label: "Koring 账户", icon: <UserCircle className={iconCls} />, component: <AccountSetting /> },
        { key: "about", label: "关于", icon: <Info className={iconCls} />, component: <AboutSetting /> },
        { key: "copyright", label: "版权", icon: <Copyright className={iconCls} />, component: <CopyrightSetting /> },
      ],
    },
    {
      title: "游戏",
      items: [
        { key: "game-account", label: "游戏账户&档案", icon: <Gamepad2 className={iconCls} />, component: <GameAccountSetting /> },
        { key: "java-mem", label: "Java虚拟机与内存", icon: <Cpu className={iconCls} />, component: <JavaMemSetting /> },
        { key: "game-dir", label: "游戏目录", icon: <FolderOpen className={iconCls} />, component: <GameDirSetting /> },
        { key: "advanced", label: "高级设置", icon: <Settings className={iconCls} />, component: <AdvancedSetting /> },
      ],
    },
    {
      title: "个性化",
      items: [
        { key: "theme-bg", label: "主题与背景", icon: <Palette className={iconCls} />, component: <ThemeBgSetting /> },
        { key: "ui", label: "主界面", icon: <Monitor className={iconCls} />, component: <UiSetting /> },
        { key: "lang", label: "语言", icon: <Languages className={iconCls} />, component: <LangSetting /> },
        { key: "a11y", label: "辅助功能", icon: <Accessibility className={iconCls} />, component: <A11ySetting /> },
      ],
    },
    {
      title: "网络",
      items: [
        { key: "download", label: "下载", icon: <Download className={iconCls} />, component: <DownloadSetting /> },
        { key: "ether-online", label: "以太联机", icon: <Globe className={iconCls} />, component: <EtherOnlineSetting /> },
        { key: "tawa-online", label: "陶瓦联机", icon: <Network className={iconCls} />, component: <TawaOnlineSetting /> },
        { key: "security-id", label: "安全识别服务", icon: <Shield className={iconCls} />, component: <SecurityIdSetting /> },
      ],
    },
    {
      title: "其他",
      items: [
        { key: "feedback", label: "服务与反馈", icon: <MessageSquareHeart className={iconCls} />, component: <FeedbackSetting /> },
        { key: "sponsor", label: "赞助我们", icon: <Heart className={iconCls} />, component: <SponsorSetting /> },
        { key: "developer", label: "开发者选项", icon: <Code className={iconCls} />, onSelect: () => routeNavigate("debug") },
      ],
    },
  ];
}

export function Setting() {
  const [selected, setSelected] = useState("home");
  const [animOn, setAnimOn] = useState(true);
  // 已访问过的子页缓存（keep-alive）：切换时不再全量卸载/重挂载，
  // 避免每个子页的 VersionCard/Silk、发布说明请求等重活反复执行；隐藏页不卸载。
  const [visited, setVisited] = useState<Record<string, boolean>>({ home: true });
  const routeNavigate = useRouteStore((s) => s.navigate);

  const switchPage = useCallback((key: string) => {
    setSelected((prev) => {
      if (prev === key) return prev;
      setVisited((v) => ({ ...v, [key]: true }));
      // 两步重放进入动画：先移除类再回加（CSS 动画重新触发，页面无需重挂载）
      setAnimOn(false);
      requestAnimationFrame(() => setAnimOn(true));
      return key;
    });
  }, []);

  const handleItemClick = useCallback((item: MenuItem) => {
    if (item.onSelect) {
      item.onSelect();
    } else {
      switchPage(item.key);
    }
  }, [switchPage]);

  const menuData = buildMenuData(switchPage, routeNavigate);
  const allItems = menuData.flatMap((g) => g.items);
  const cachedItems = allItems.filter((i) => visited[i.key]);

  return (
    <div className="flex h-full">
      {/* 侧边栏 */}
      <aside className="scroll-area w-[220px] shrink-0 h-full overflow-y-auto py-5 pl-4 pr-2">
        <nav className="space-y-6">
          {menuData.map((group, gi) => (
            <div key={group.title}>
              {gi > 0 && <div className="mx-3 mb-3 border-t border-border/40" />}
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-foreground/40 mb-2 px-3">
                {group.title}
              </h3>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = selected === item.key && !item.onSelect;
                  return (
                    <button
                      key={item.key}
                      onClick={() => handleItemClick(item)}
                      className={[
                        "relative w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-[13.5px] transition-all duration-150",
                        active
                          ? "text-foreground font-medium"
                          : "text-foreground/50 hover:text-foreground/80 hover:bg-foreground/[0.04]",
                      ].join(" ")}
                    >
                      {active && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[16px] rounded-full bg-primary" />
                      )}
                      <span className={active ? "text-foreground/80" : "text-foreground/35"}>
                        {item.icon}
                      </span>
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* 内容区（已访问页缓存保活；仅活动页可见并重放进入动画） */}
      <main className="scroll-area flex-1 h-full overflow-y-auto p-8">
        {cachedItems.map((item) => {
          const active = selected === item.key;
          return (
            <div key={item.key} className={active ? (animOn ? "setting-page-enter" : undefined) : "hidden"}>
              {item.component}
            </div>
          );
        })}
      </main>
    </div>
  );
}
