import { useRouteStore } from "@/stores/routeStore";
import { Monitor, Paintbrush, CreditCard, ListTodo, ChevronRight, FlaskConical, Rocket, AlertTriangle, RefreshCw, SquareTerminal } from "lucide-react";

const debugPages = [
  {
    key: "debug-update" as const,
    icon: RefreshCw,
    title: "更新功能测试",
    desc: "设置测试版本号、检查更新、获取发布说明、版本比对与下载",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
  {
    key: "debug-crash" as const,
    icon: AlertTriangle,
    title: "崩溃测试",
    desc: "模拟崩溃、测试崩溃弹窗、查看崩溃日志与强还原配置",
    color: "text-red-500",
    bg: "bg-red-500/10",
  },
  {
    key: "debug-splash" as const,
    icon: Monitor,
    title: "启动动画调试",
    desc: "测试 Splash Screen 的显示、关闭与启动流程模拟",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    key: "debug-display" as const,
    icon: Paintbrush,
    title: "显示效果调试",
    desc: "调试背景遮罩、磨砂效果与视觉表现",
    color: "text-purple-500",
    bg: "bg-purple-500/10",
  },
  {
    key: "debug-version-card" as const,
    icon: CreditCard,
    title: "版本卡片调试",
    desc: "测试 VersionCard 在不同模式与更新状态下的表现",
    color: "text-amber-500",
    bg: "bg-amber-500/10",
  },
  {
    key: "debug-task" as const,
    icon: ListTodo,
    title: "任务队列调试",
    desc: "测试任务调度、进度条、日志与 Sheet 面板",
    color: "text-cyan-500",
    bg: "bg-cyan-500/10",
  },
  {
    key: "oobe" as const,
    icon: Rocket,
    title: "OOBE 开箱体验",
    desc: "查看开箱引导页面，标题栏切换为 OOBE 模式",
    color: "text-pink-500",
    bg: "bg-pink-500/10",
  },
];

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
        className="glass-card w-full px-5 py-4 text-left hover:scale-[1.01] active:scale-[0.99] transition-transform cursor-pointer group mb-4"
      >
        <div className="flex items-center gap-4">
          <div className="p-2.5 rounded-xl bg-foreground/[0.08]">
            <SquareTerminal className="w-5 h-5 text-foreground/60" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">打开开发者工具</p>
            <p className="text-[13px] text-muted-foreground mt-0.5">打开浏览器调试工具（Chromium DevTools），查看控制台与网络请求</p>
          </div>
          <ChevronRight className="w-4 h-4 text-foreground/20 group-hover:text-foreground/40 transition-colors shrink-0" />
        </div>
      </button>

      <div className="space-y-3">
        {debugPages.map((p) => (
          <button
            key={p.key}
            onClick={() => navigate(p.key)}
            className="glass-card w-full px-5 py-4 text-left hover:scale-[1.01] active:scale-[0.99] transition-transform cursor-pointer group"
          >
            <div className="flex items-center gap-4">
              <div className={`p-2.5 rounded-xl ${p.bg}`}>
                <p.icon className={`w-5 h-5 ${p.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{p.title}</p>
                <p className="text-[13px] text-muted-foreground mt-0.5">{p.desc}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-foreground/20 group-hover:text-foreground/40 transition-colors shrink-0" />
            </div>
          </button>
        ))}
      </div>

      <p className="text-[12px] text-muted-foreground/50 mt-6 text-center">
        这些工具仅用于开发调试，不会影响启动器的正常运行
      </p>
    </div>
  );
}
