import { useState, useCallback, useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import clsx from "clsx";
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

/**
 * 侧边栏条目顺序（与 buildMenuData 的分组顺序一致）。
 * 子页切换时用它判断「去往更靠下的条目还是更靠上的条目」，从而决定内容区从哪一侧进入。
 */
const MENU_ORDER = [
  "home",
  "about",
  "copyright",
  "game",
  "game-account",
  "java-mem",
  "game-dir",
  "advanced",
  "theme-bg",
  "ui",
  "lang",
  "a11y",
  "download",
  "ether-online",
  "tawa-online",
  "security-id",
  "feedback",
  "sponsor",
];

type PageDir = "up" | "down";

interface PageTransition {
  /** 正在退出的子页 key */
  from: string;
  /** down = 选中更靠下的条目，新页从下方进入；up = 反方向 */
  dir: PageDir;
}

function buildMenuData(
  switchPage: (key: string) => void,
  routeNavigate: (key: any) => void,
  developerMode: boolean,
  selected: string,
): MenuGroup[] {
  return [
    {
      title: "通用",
      items: [
        { key: "home", label: "主页", icon: <Home className={iconCls} />, component: <HomeSetting onNavigate={switchPage} sharedTransition={selected === "home"} /> },
        // Koring 账户（暂时隐藏）
        // { key: "account", label: "Koring 账户", icon: <UserCircle className={iconCls} />, component: <AccountSetting /> },
        { key: "about", label: "关于", icon: <Info className={iconCls} />, component: <AboutSetting sharedTransition={selected === "about"} /> },
        { key: "copyright", label: "版权", icon: <Copyright className={iconCls} />, component: <CopyrightSetting /> },
      ],
    },
    {
      title: "游戏",
      items: [
        { key: "game", label: "游戏", icon: <Rocket className={iconCls} />, component: <GameSetting /> },
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
        // 「开发者选项」由服务端下发：设备接口 data.developer_mode === true 才显示
        ...(developerMode
          ? [{ key: "developer", label: "开发者选项", icon: <Code className={iconCls} />, onSelect: () => routeNavigate("debug") }]
          : []),
      ],
    },
  ];
}

export function Setting() {
  const [selected, setSelected] = useState("home");
  // 子页切换的方向性过渡：记录正在退出的页面与方向（up/down），与侧边栏条目顺序绑定
  const [transition, setTransition] = useState<PageTransition | null>(null);
  // 已访问过的子页缓存（keep-alive）：切换时不再全量卸载/重挂载，
  // 避免每个子页的 VersionCard/Silk、发布说明请求等重活反复执行；隐藏页不卸载。
  const [visited, setVisited] = useState<Record<string, boolean>>({ home: true });
  const routeNavigate = useRouteStore((s) => s.navigate);
  // 服务端下发的开发者模式（设备接口 data.developer_mode）；false 时隐藏「开发者选项」入口
  const developerMode = useDeveloperModeStore((s) => s.enabled);

  const transitionTimer = useRef<number | undefined>(undefined);
  const navRef = useRef<HTMLElement | null>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [indicatorTop, setIndicatorTop] = useState(0);

  // 进入设置页时按需复查一次（冷却 5 分钟，超时才真正发请求；见 developerModeStore）
  useEffect(() => {
    void refreshDeveloperMode();
  }, []);

  // 卸载时清掉切换定时器，避免对已卸载组件 setState
  useEffect(() => () => window.clearTimeout(transitionTimer.current), []);

  // 侧栏选中指示条：按实际 DOM 位置测量（分组/分隔线/开发者项变化都能跟随）
  const updateIndicator = useCallback(() => {
    const nav = navRef.current;
    const button = itemRefs.current[selected];
    if (!nav || !button) return;
    const navRect = nav.getBoundingClientRect();
    const rect = button.getBoundingClientRect();
    setIndicatorTop(rect.top - navRect.top + rect.height / 2 - 8);
  }, [selected]);

  useLayoutEffect(() => {
    updateIndicator();
  }, [updateIndicator, developerMode, visited]);

  useEffect(() => {
    window.addEventListener("resize", updateIndicator);
    // 字体加载（Alimama/Inter）或侧栏内容变化会改变条目高度，需要重新测量指示条位置
    const nav = navRef.current;
    let observer: ResizeObserver | null = null;
    if (nav && typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(updateIndicator);
      observer.observe(nav);
    }
    document.fonts?.ready.then(() => updateIndicator()).catch(() => {});
    return () => {
      window.removeEventListener("resize", updateIndicator);
      observer?.disconnect();
    };
  }, [updateIndicator]);

  const switchPage = (key: string) => {
    if (key === selected) return;
    const fromIndex = MENU_ORDER.indexOf(selected);
    const toIndex = MENU_ORDER.indexOf(key);
    // 侧边栏是纵向列表：去更靠下的条目，新页从下方进入、旧页向上退出；反之镜像。
    // 这样“从哪来到哪去”由用户点击的位置决定，而不是固定的左进右出。
    const dir: PageDir = toIndex >= fromIndex ? "down" : "up";
    setVisited((v) => ({ ...v, [key]: true }));
    setTransition({ from: selected, dir });
    setSelected(key);
    window.clearTimeout(transitionTimer.current);
    // 旧页 220ms 渐出 + 新页 60ms 延迟后 360ms 渐入，留一点余量再清理过渡状态
    transitionTimer.current = window.setTimeout(() => setTransition(null), 460);
  };

  const handleItemClick = useCallback(
    (item: MenuItem) => {
      if (item.onSelect) {
        item.onSelect();
      } else {
        switchPage(item.key);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selected],
  );

  const menuData = buildMenuData(switchPage, routeNavigate, developerMode, selected);
  const allItems = menuData.flatMap((g) => g.items);
  const cachedItems = allItems.filter((i) => visited[i.key]);

  return (
    <div className="flex h-full">
      {/* 侧边栏 */}
      <aside className="scroll-area w-[220px] shrink-0 h-full overflow-y-auto py-5 pl-4 pr-2">
        <nav ref={navRef} className="relative space-y-6">
          {/* 选中指示条：单个元素在侧栏内滑动（spring），而不是每个条目各弹一条，切换不再生硬 */}
          <span
            aria-hidden
            className="pointer-events-none absolute left-0 top-0 z-10 h-4 w-[3px] rounded-full bg-primary"
            style={{
              transform: `translateY(${indicatorTop}px)`,
              transition: "transform 260ms var(--ease-spring)",
            }}
          />
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
                      ref={(el) => {
                        itemRefs.current[item.key] = el;
                      }}
                      onClick={() => handleItemClick(item)}
                      className={clsx(
                        "relative w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-[13.5px] transition-[color,background-color] duration-200 ease-spring-soft active:scale-[0.99]",
                        active
                          ? "text-foreground font-medium"
                          : "text-foreground/50 hover:text-foreground/80 hover:bg-foreground/[0.04]",
                      )}
                    >
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

      {/* 内容区（已访问页缓存保活；每个子页独立滚动，切换时新旧页分层叠加做方向性进出场） */}
      <main className="relative flex-1 h-full overflow-hidden">
        {cachedItems.map((item) => {
          const active = selected === item.key;
          const leaving = transition?.from === item.key;
          const animClass =
            active && transition
              ? `setting-page-enter-${transition.dir}`
              : leaving
                ? `setting-page-exit-${transition.dir}`
                : undefined;
          return (
            <div
              key={item.key}
              className={clsx(
                "absolute inset-0 scroll-area overflow-y-auto p-8",
                !active && !leaving && "hidden",
                animClass,
              )}
            >
              {item.component}
            </div>
          );
        })}
      </main>
    </div>
  );
}
