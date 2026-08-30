import { BUILD_MODE, LOGO_SVG } from "@/lib/mode";
import { VERSION } from "@/lib/version";
import { BUILD_COMMIT, BUILD_ID } from "@/lib/buildInfo";
import { useUpdateStore } from "@/stores/updateStore";
import { useRouteStore } from "@/stores/routeStore";
import { relaunchApp } from "@/api/update";
import Silk from "@/components/silk/Silk";
import { Button } from "@heroui/react";
import clsx from "clsx";
import { type ReactNode, Suspense } from "react";

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
  /** OOBE 模式：不显示 Silk 动画，按钮仅展示样式不做实际操作 */
  oobe?: boolean;
}

export function VersionCard({
  className,
  overrideMode,
  overrideState,
  simple = false,
  oobe = false,
}: VersionCardProps) {
  const color = modeColors[overrideMode ?? BUILD_MODE] ?? modeColors.run;
  const gradient = modeGradients[overrideMode ?? BUILD_MODE] ?? modeGradients.run;
  const label = modeLabels[overrideMode ?? BUILD_MODE] ?? modeLabels.run;

  const { checking, downloading, installed, update, check, install } = useUpdateStore();

  // 检查更新按钮：除 OOBE 与更新日志页本身外，点击跳转到更新日志页
  const current = useRouteStore((s) => s.current);
  const navigate = useRouteStore((s) => s.navigate);
  const isOnUpdatePage = current === "update";
  const handleCheck = () => {
    if (isOnUpdatePage) {
      check();
    } else {
      navigate("update");
    }
  };

  const effectiveState: UpdateState = overrideState ?? (installed ? "installed" : update ? "hasUpdate" : "latest");

  const Btn = (props: React.ComponentProps<typeof Button>) => (
    <Button
      size="sm"
      variant="ghost"
      className="text-white/90 hover:text-white hover:bg-white/10 border border-white/20"
      {...props}
    />
  );

  return (
    <div
      className={clsx("relative overflow-hidden rounded-xl border border-white/10 min-h-[200px]", className)}
      // 共享元素过渡：路由切换时（startViewTransition），新旧页面中同名 view-transition-name
      // 的元素会从上一个位置平滑移动/形变到当前页面的位置
      style={{ viewTransitionName: "version-card" } as React.CSSProperties}
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

      {/* 内容（移除颜色遮罩层，保留底部渐变与 Silk 动画渲染） */}
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

        {/* 更新日志页内不显示任何按钮（更新操作由页面底部遮罩负责） */}
        {!isOnUpdatePage && (
          <>
          {/* OOBE 模式：仅显示查看亮点按钮 */}
          {oobe ? (
            <div className="flex items-center gap-2 mt-1">
              <Btn>查看亮点</Btn>
            </div>
        ) : (
          <div className="flex items-center gap-2 mt-1">
          {effectiveState === "latest" && (
            <>
              <Btn onPress={handleCheck} isDisabled={checking}>
                {checking ? "检查中..." : "检查更新"}
              </Btn>
              <Btn>查看亮点</Btn>
            </>
          )}

          {effectiveState === "hasUpdate" && (
            <>
              <span className="text-[12px] text-white/80 mr-1">有新的版本可用</span>
              <Btn onPress={install} isDisabled={downloading}>
                {downloading ? "下载中..." : "下载更新"}
              </Btn>
            </>
          )}

          {effectiveState === "installed" && (
            <>
              <span className="text-[12px] text-white/80 mr-1">更新已下载</span>
              <Btn onPress={relaunchApp}>立即更新</Btn>
            </>
          )}
          </div>
        )}
          </>
        )}
      </div>
    </div>
  );
}
