import { useState, useEffect } from "react";
import {
  Home,
  Info,
  Copyright,
  Gamepad2,
  Rocket,
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
import { useDeveloperModeStore, refreshDeveloperMode } from "@/stores/developerModeStore";
import { PageShell, type PageShellGroup } from "@/components/page-shell";
import { SettingsAccountCard } from "@/components/account/SettingsAccountCard";

import { HomeSetting } from "./general/home";
// import { AccountSetting } from "./general/account";  // Koring 账户（暂时隐藏）
import { AboutSetting } from "./general/about";
import { CopyrightSetting } from "./general/copyright";
import { GameSetting } from "./game/game";
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

const iconCls = "w-[18px] h-[18px] shrink-0";

/**
 * 侧边栏分组数据。
 * 条目顺序即子页切换方向：去更靠下的条目新页从下方进入，反之镜像（由 PageShell 统一处理）。
 */
function buildMenuData(
  switchPage: (key: string) => void,
  routeNavigate: (key: any) => void,
  developerMode: boolean,
  selected: string,
): PageShellGroup[] {
  return [
    {
      title: "通用",
      items: [
        { key: "home", label: "主页", icon: <Home className={iconCls} />, content: <HomeSetting onNavigate={switchPage} sharedTransition={selected === "home"} /> },
        // Koring 账户（暂时隐藏）
        // { key: "account", label: "Koring 账户", icon: <UserCircle className={iconCls} />, content: <AccountSetting /> },
        { key: "about", label: "关于", icon: <Info className={iconCls} />, content: <AboutSetting sharedTransition={selected === "about"} /> },
        { key: "copyright", label: "版权", icon: <Copyright className={iconCls} />, content: <CopyrightSetting /> },
      ],
    },
    {
      title: "游戏",
      items: [
        { key: "game", label: "游戏", icon: <Rocket className={iconCls} />, content: <GameSetting /> },
        { key: "game-account", label: "游戏账户&档案", icon: <Gamepad2 className={iconCls} />, content: <GameAccountSetting /> },
        { key: "java-mem", label: "Java虚拟机与内存", icon: <Cpu className={iconCls} />, content: <JavaMemSetting /> },
        { key: "game-dir", label: "游戏目录", icon: <FolderOpen className={iconCls} />, content: <GameDirSetting /> },
        { key: "advanced", label: "高级设置", icon: <Settings className={iconCls} />, content: <AdvancedSetting /> },
      ],
    },
    {
      title: "个性化",
      items: [
        { key: "theme-bg", label: "主题与背景", icon: <Palette className={iconCls} />, content: <ThemeBgSetting /> },
        { key: "ui", label: "主界面", icon: <Monitor className={iconCls} />, content: <UiSetting /> },
        { key: "lang", label: "语言", icon: <Languages className={iconCls} />, content: <LangSetting /> },
        { key: "a11y", label: "辅助功能", icon: <Accessibility className={iconCls} />, content: <A11ySetting /> },
      ],
    },
    {
      title: "网络",
      items: [
        { key: "download", label: "下载", icon: <Download className={iconCls} />, content: <DownloadSetting /> },
        { key: "ether-online", label: "以太联机", icon: <Globe className={iconCls} />, content: <EtherOnlineSetting /> },
        { key: "tawa-online", label: "陶瓦联机", icon: <Network className={iconCls} />, content: <TawaOnlineSetting /> },
        { key: "security-id", label: "KoringDevice 服务", icon: <Shield className={iconCls} />, content: <SecurityIdSetting /> },
      ],
    },
    {
      title: "其他",
      items: [
        { key: "feedback", label: "服务与反馈", icon: <MessageSquareHeart className={iconCls} />, content: <FeedbackSetting /> },
        { key: "sponsor", label: "赞助我们", icon: <Heart className={iconCls} />, content: <SponsorSetting /> },
        // 「开发者选项」由服务端下发：设备接口 data.developer_mode === true 才显示
        ...(developerMode
          ? [{ key: "developer", label: "开发者选项", icon: <Code className={iconCls} />, onSelect: () => routeNavigate("debug") }]
          : []),
      ],
    },
  ];
}

export function Setting() {
  // 每次进入设置页都回到「通用 → 主页」
  const [selected, setSelected] = useState("home");
  const routeNavigate = useRouteStore((s) => s.navigate);
  // 服务端下发的开发者模式（设备接口 data.developer_mode）；false 时隐藏「开发者选项」入口
  const developerMode = useDeveloperModeStore((s) => s.enabled);

  // 进入设置页时按需复查一次（冷却 5 分钟，超时才真正发请求；见 developerModeStore）
  useEffect(() => {
    void refreshDeveloperMode();
  }, []);

  const menuData = buildMenuData(setSelected, routeNavigate, developerMode, selected);

  return (
    <PageShell
      groups={menuData}
      value={selected}
      onValueChange={setSelected}
      navLabel="设置导航"
      sidebarHeader={<SettingsAccountCard />}
    />
  );
}
