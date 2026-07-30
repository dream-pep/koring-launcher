import { BUILD_MODE, LOGO_SVG } from "@/lib/mode";
import { VERSION } from "@/lib/version";
import { useUpdateStore } from "@/stores/updateStore";
import { relaunchApp } from "@/api/update";
import Silk from "@/components/silk/Silk";
import { Button } from "@heroui/react";
import clsx from "clsx";
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
}

export function VersionCard({
  className,
  overrideMode,
  overrideState,
  simple = false,
}: VersionCardProps) {
  const color = modeColors[overrideMode ?? BUILD_MODE] ?? modeColors.run;
  const gradient = modeGradients[overrideMode ?? BUILD_MODE] ?? modeGradients.run;
  const label = modeLabels[overrideMode ?? BUILD_MODE] ?? modeLabels.run;

  const { checking, downloading, installed, update, check, install } = useUpdateStore();

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
    <div className={clsx("relative overflow-hidden rounded-xl border border-white/10 min-h-[200px]", className)}>
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

      {/* 磨砂遮罩 */}
      <div
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.25)", backdropFilter: "blur(12px)" }}
      />

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

        <div className="flex items-center gap-2 mt-1">
          {effectiveState === "latest" && (
            <>
              <Btn onPress={check} isDisabled={checking}>
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
      </div>
    </div>
  );
}
