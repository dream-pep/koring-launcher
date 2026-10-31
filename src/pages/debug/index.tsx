import { useRouteStore } from "@/stores/routeStore";
import {
  Waypoints,
  Monitor,
  Paintbrush,
  CreditCard,
  ListTodo,
  ChevronRight,
  FlaskConical,
  Rocket,
  AlertTriangle,
  RefreshCw,
  SquareTerminal,
  MemoryStick,
  ShieldCheck,
  KeyRound,
  Gamepad2,
  Search,
} from "lucide-react";

// 调试入口卡片
interface DebugEntry {
  key: string;
  icon: typeof Waypoints;
  title: string;
  desc: string;
  color: string;
  bg: string;
}

// 按用途分组的调试工具
const toolGroups: { title: string; pages: DebugEntry[] }[] = [
  {
    title: "功能测试",
    pages: [
      {
        key: "debug-routes",
        icon: Waypoints,
        title: "页面跳转",
        desc: "列出所有已注册的页面（含隐藏页），点击即可快速跳转预览",
        color: "text-sky-500",
        bg: "bg-sky-500/10",
      },
      {
        key: "debug-update",
        icon: RefreshCw,
        title: "更新功能测试",
        desc: "设置测试版本号、检查更新、获取发布说明、版本比对与下载",
        color: "text-emerald-500",
        bg: "bg-emerald-500/10",
      },
      {
        key: "debug-activation",
        icon: ShieldCheck,
        title: "激活校验测试",
        desc: "设备状态/上报、版本策略、启动门禁的直调与校验页预览（Account API）",
        color: "text-orange-500",
        bg: "bg-orange-500/10",
      },
      {
        key: "debug-crash",
        icon: AlertTriangle,
        title: "崩溃测试",
        desc: "模拟崩溃、测试崩溃弹窗、查看崩溃日志与强还原配置",
        color: "text-red-500",
        bg: "bg-red-500/10",
      },
      {
        key: "debug-task",
        icon: ListTodo,
        title: "任务队列调试",
        desc: "测试任务调度、进度条、日志与 Sheet 面板",
        color: "text-cyan-500",
        bg: "bg-cyan-500/10",
      },
      {
        key: "debug-auth",
        icon: KeyRound,
        title: "账号认证调试",
        desc: "多账号列表、离线登录、LittleSkin 登录与账号切换/移除",
        color: "text-lime-500",
        bg: "bg-lime-500/10",
      },
      {
        key: "debug-instance",
        icon: Gamepad2,
        title: "实例与启动调试",
        desc: "实例列表、启动环境体检（版本/依赖）与真实启动事件流",
        color: "text-teal-500",
        bg: "bg-teal-500/10",
      },
    ],
  },
  {
    title: "视觉与外观",
    pages: [
      {
        key: "debug-display",
        icon: Paintbrush,
        title: "显示效果调试",
        desc: "主题、遮罩、无障碍、背景参数与通知预览",
        color: "text-purple-500",
        bg: "bg-purple-500/10",
      },
      {
        key: "debug-splash",
        icon: Monitor,
        title: "启动动画调试",
        desc: "测试 Splash Screen 的显示、关闭与启动流程模拟",
        color: "text-blue-500",
        bg: "bg-blue-500/10",
      },
      {
        key: "debug-version-card",
        icon: CreditCard,
        title: "版本卡片调试",
        desc: "测试 VersionCard 在不同模式与更新状态下的表现",
        color: "text-amber-500",
        bg: "bg-amber-500/10",
      },
    ],
  },
  {
    title: "网络与资源",
    pages: [
      {
        key: "debug-mods",
        icon: Search,
        title: "资源搜索调试",
        desc: "Modrinth 搜索（关键词/排序）与模组安装到游戏目录",
        color: "text-indigo-500",
        bg: "bg-indigo-500/10",
      },
    ],
  },
  {
    title: "系统与数据",
    pages: [
      {
        key: "debug-resource",
        icon: MemoryStick,
        title: "资源与内存",
        desc: "监控渲染进程 JS 堆、进程工作集与资源注册表占用，验证内存优化",
        color: "text-violet-500",
        bg: "bg-violet-500/10",
      },
    ],
  },
  {
    title: "引导流程",
    pages: [
      {
        key: "oobe",
        icon: Rocket,
        title: "OOBE 开箱体验",
        desc: "查看开箱引导页面，标题栏切换为 OOBE 模式",
        color: "text-pink-500",
        bg: "bg-pink-500/10",
      },
    ],
  },
];

// 单个入口卡片
function ToolCard({ page, onOpen }: { page: DebugEntry; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="glass-card w-full px-5 py-4 text-left hover:scale-[1.01] active:scale-[0.99] transition-transform duration-200 ease-spring-soft cursor-pointer group"
    >
      <div className="flex items-center gap-4">
        <div className={`p-2.5 rounded-xl ${page.bg}`}>
          <page.icon className={`w-5 h-5 ${page.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">{page.title}</p>
          <p className="text-[13px] text-muted-foreground mt-0.5">{page.desc}</p>
        </div>
        <ChevronRight className="w-4 h-4 text-foreground/20 group-hover:text-foreground/40 transition-colors shrink-0" />
      </div>
    </button>
  );
}

export function Debug() {
  const navigate = useRouteStore((s) => s.navigate);

  return (
    <div className="max-w-2xl mx-auto p-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2.5 rounded-xl bg-foreground/[0.06]">
          <FlaskConical className="w-5 h-5 text-foreground/60" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">开发者工具</h1>
          <p className="text-sm text-muted-foreground">调试启动器的各项功能与视觉效果</p>
        </div>
      </div>

      {/* 打开浏览器调试工具（DevTools） */}
      <button
        onClick={() => window.electronAPI?.openDevTools()}
        className="glass-card w-full px-5 py-4 text-left hover:scale-[1.01] active:scale-[0.99] transition-transform duration-200 ease-spring-soft cursor-pointer group mb-6"
      >
        <div className="flex items-center gap-4">
          <div className="p-2.5 rounded-xl bg-foreground/[0.08]">
            <SquareTerminal className="w-5 h-5 text-foreground/60" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">打开开发者工具</p>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              打开浏览器调试工具（Chromium DevTools），查看控制台与网络请求
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-foreground/20 group-hover:text-foreground/40 transition-colors shrink-0" />
        </div>
      </button>

      {/* 分组工具列表 */}
      <div className="space-y-6">
        {toolGroups.map((group) => (
          <div key={group.title}>
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-foreground/30 mb-2.5 px-1">
              {group.title}
            </h2>
            <div className="space-y-3">
              {group.pages.map((page) => (
                <ToolCard key={page.key} page={page} onOpen={() => navigate(page.key as never)} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="text-[12px] text-muted-foreground/50 mt-6 text-center">
        这些工具仅用于开发调试，不会影响启动器的正常运行
      </p>
    </div>
  );
}
