import { BUILD_MODE } from "@/lib/mode";
import { useUpdateStore } from "@/stores/updateStore";
import { relaunchApp } from "@/api/update";
import Silk from "@/components/silk/Silk";
import { Button } from "@/components/ui/button";
import clsx from "clsx";

const modeColors: Record<string, string> = {
  dev: "#F59E0B",
  beta: "#10B981",
  run: "#3B82F6",
};

const modeLabels: Record<string, string> = {
  dev: "开发版",
  beta: "测试版",
  run: "正式版",
};

const VERSION = "0.1.0";

type UpdateState = "latest" | "hasUpdate" | "installed";

interface VersionCardProps {
  className?: string;
  /** 开发者模式：覆盖颜色 */
  overrideMode?: string | null;
  /** 开发者模式：覆盖更新状态 */
  overrideState?: UpdateState | null;
  /** 开发者模式：遮罩透明度 (0-100) */
  overlayOpacity?: number;
  /** 开发者模式：模糊强度 (px) */
  blurAmount?: number;
}

export function VersionCard({
  className,
  overrideMode,
  overrideState,
  overlayOpacity = 30,
  blurAmount = 12,
}: VersionCardProps) {
  const color = modeColors[overrideMode ?? BUILD_MODE] ?? modeColors.run;
  const label = modeLabels[overrideMode ?? BUILD_MODE] ?? modeLabels.run;

  const { checking, downloading, installed, update, check, install } = useUpdateStore();

  const effectiveState: UpdateState = overrideState ?? (installed ? "installed" : update ? "hasUpdate" : "latest");

  return (
    <div
      className={clsx(
        "relative overflow-hidden rounded-xl border border-white/10",
        className,
      )}
    >
      {/* Silk 背景 */}
      <div className="absolute inset-0 z-0">
        <Silk speed={3} scale={1.2} color={color} noiseIntensity={1.2} rotation={0.3} />
      </div>

      {/* 磨砂层 */}
      <div
        className="absolute inset-0 z-[1]"
        style={{
          background: `rgba(0,0,0,${overlayOpacity / 100})`,
          backdropFilter: `blur(${blurAmount}px)`,
        }}
      />

      {/* 内容层 */}
      <div className="relative z-10 flex flex-col items-center justify-center px-6 py-10 gap-4">
        {/* 版本类型 */}
        <span className="text-[11px] font-bold tracking-wider text-white/70">
          {label}
        </span>

        {/* Logo */}
        <img src="/koring-licon.svg" alt="Koring" className="w-50 h-20 drop-shadow-lg" style={{ filter: "brightness(0) invert(1)" }} />

        {/* 版本号 */}
        <p className="text-sm text-white/70 font-medium">v{VERSION}</p>

        {/* 按钮组 */}
        <div className="flex items-center gap-2 mt-1">
          {effectiveState === "latest" && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white"
                onClick={check}
                disabled={checking}
              >
                {checking ? "检查中..." : "检查更新"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white"
              >
                查看亮点
              </Button>
            </>
          )}

          {effectiveState === "hasUpdate" && (
            <>
              <span className="text-[12px] text-white/80 mr-1">
                有新的版本可用
              </span>
              <Button
                size="sm"
                variant="outline"
                className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white"
                onClick={install}
                disabled={downloading}
              >
                {downloading ? "下载中..." : "下载更新"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white"
              >
                查看亮点
              </Button>
            </>
          )}

          {effectiveState === "installed" && (
            <>
              <span className="text-[12px] text-white/80 mr-1">
                更新已下载
              </span>
              <Button
                size="sm"
                variant="outline"
                className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white"
                onClick={relaunchApp}
              >
                立即更新
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
