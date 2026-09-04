import { BUILD_MODE, LOGO_SVG } from "@/lib/mode";
import { VERSION } from "@/lib/version";
import { BUILD_COMMIT, BUILD_ID } from "@/lib/buildInfo";
import { useUpdateStore } from "@/stores/updateStore";
import { useRouteStore } from "@/stores/routeStore";
import Silk from "@/components/silk/Silk";
import clsx from "clsx";
import { ChevronRight } from "lucide-react";
import { Suspense } from "react";

const modeColors: Record<string, string> = {
  dev: "#F59E0B",
  beta: "#10B981",
  run: "#3B82F6",
};

const modeGradients: Record<string, string> = {
  dev: "linear-gradient(135deg, #F59E0B, #D97706)",
  beta: "linear-gradient(135deg, #10B981, #059669)",
  run: "linear-gradient(135deg, #3B82F6, #2563EB)",
};

const modeLabels: Record<string, string> = {
  dev: "开发版",
  beta: "测试版",
  run: "正式版",
};

type UpdateState = "latest" | "hasUpdate" | "installed";

interface VersionCardProps {
  className?: string;
  overrideMode?: string | null;
  overrideState?: UpdateState | null;
  simple?: boolean;
  /** OOBE 模式：仅展示样式，不显示「查看更新」入口 */
  oobe?: boolean;
  /**
   * 设置页模式（设置主页 / 关于页）：整卡可点击跳转更新页，
   * 并显示「查看更新」小字提示；其他页面为 false
   */
  isSettingPage?: boolean;
  /**
   * 关闭共享元素过渡（view-transition-name）：弹窗/浮层里复用 VersionCard 时开启，
   * 避免与页面上的 VersionCard 重名导致路由切换过渡失效
   */
  noViewTransition?: boolean;
}

export function VersionCard({
  className,
  overrideMode,
  overrideState,
  simple = false,
  oobe = false,
  isSettingPage = false,
  noViewTransition = false,
}: VersionCardProps) {
  const color = modeColors[overrideMode ?? BUILD_MODE] ?? modeColors.run;
  const gradient = modeGradients[overrideMode ?? BUILD_MODE] ?? modeGradients.run;
  const label = modeLabels[overrideMode ?? BUILD_MODE] ?? modeLabels.run;

  const { update, installed } = useUpdateStore();

  const current = useRouteStore((s) => s.current);
  const navigate = useRouteStore((s) => s.navigate);

  const effectiveState: UpdateState = overrideState ?? (installed ? "installed" : update ? "hasUpdate" : "latest");

  // 设置页：整卡可点击，跳转检查更新页面（更新日志页自身不触发）
  const clickable = isSettingPage && !oobe && current !== "update";
  const handleCardClick = () => {
    if (clickable) navigate("update");
  };

  return (
    <div
      className={clsx(
        "relative overflow-hidden rounded-xl border border-white/10 min-h-[200px]",
        clickable && "cursor-pointer hover:scale-[1.01] active:scale-[0.99] transition-transform",
        className,
      )}
      onClick={handleCardClick}
      // 共享元素过渡：路由切换时（startViewTransition），新旧页面中同名 view-transition-name
      // 的元素会从上一个位置平滑移动/形变到当前页面的位置。
      // 浮层/弹窗复用（noViewTransition）时关闭，避免与页面卡片重名打断过渡。
      style={
        noViewTransition
          ? undefined
          : ({ viewTransitionName: "version-card" } as React.CSSProperties)
      }
    >
      {/* 背景层 */}
      <div className="absolute inset-0" style={{ background: gradient }} />

      {/* Silk 动画层 (非 simple 模式) */}
      {!simple && (
        <Suspense fallback={null}>
          <div className="absolute inset-0 opacity-60 mix-blend-soft-light">
            <Silk speed={3} scale={1.2} color={color} noiseIntensity={1.2} rotation={0.3} />
          </div>
        </Suspense>
      )}

      {/* 内容 */}
      <div className="relative z-10 flex flex-col items-center justify-center px-6 py-10 gap-4">
        <span className="text-[11px] font-bold tracking-wider text-white/70">{label}</span>
        <img
          src={LOGO_SVG}
          alt="Koring"
          className="w-40 h-auto drop-shadow-lg"
          style={{ filter: "brightness(0) invert(1)" }}
        />
        <p className="text-sm text-white/70 font-medium">v{VERSION}</p>

        {/* 构建来源（CI 构建时写入；本地开发不显示） */}
        {(BUILD_COMMIT || BUILD_ID !== "local") && (
          <p className="text-[11px] text-white/50 font-mono leading-none">
            {BUILD_COMMIT && `commit ${BUILD_COMMIT}`}
            {BUILD_COMMIT && BUILD_ID !== "local" && " · "}
            {BUILD_ID !== "local" && `#${BUILD_ID}`}
          </p>
        )}

        {/* 更新状态提示（仅信息，不提供按钮；下载/安装操作在更新页底部完成） */}
        {effectiveState !== "latest" && (
          <p className="text-[12px] text-white/80">
            {effectiveState === "hasUpdate" ? "有新的版本可用" : "更新已下载"}
          </p>
        )}

        {/* 设置页：整卡可点击跳转更新页，显示入口小字 */}
        {clickable && (
          <span className="inline-flex items-center gap-0.5 text-[11px] text-white/60 transition-colors group-hover:text-white">
            查看更新
            <ChevronRight className="w-3 h-3" />
          </span>
        )}
      </div>
    </div>
  );
}
