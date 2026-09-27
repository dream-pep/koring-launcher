import { useEffect, useState } from "react";
import { useRouteStore } from "@/stores/routeStore";
import { useConfigStore } from "@/stores/configStore";
import { launcherStartupCheck } from "@/api/launcher-api";
import { OobeLayout } from "./layout";
import { AppleHelloEnglishEffect } from "@/components/ui/apple-hello-effect";
import { Loader2 } from "lucide-react";

/**
 * OOBE 结束页。
 *
 * 强制完成激活：进入本页时再复核一次（设备 + 版本，主进程侧 30s 缓存会被 force 绕过），
 * 未通过则退回对应步骤而不是放行：
 *   设备黑名单 → 设备校验页；版本禁激活 → 版本激活页；需强制升级 → 版本更新页。
 * 只有 activation.deviceOk && activation.versionOk 同时为真才显示「前往首页」。
 */
export function OobeFinish() {
  const navigate = useRouteStore((s) => s.navigate);
  const setOobe = useConfigStore((s) => s.setOobe);
  const activation = useConfigStore((s) => s.config.activation);
  const setActivation = useConfigStore((s) => s.setActivation);

  const [gateOk, setGateOk] = useState<boolean | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [showRetry, setShowRetry] = useState(false);

  // 「前往首页」按钮先隐藏，hello 动画播完后（4 秒）渐入浮现
  const [btnVisible, setBtnVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setBtnVisible(true), 4000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setGateOk(null);
    launcherStartupCheck(true)
      .then((result) => {
        if (cancelled) return;
        if (result.block === "device_blacklisted") {
          navigate("oobe/device");
          return;
        }
        if (result.block === "activation_blocked") {
          navigate("oobe/activation");
          return;
        }
        if (result.block === "force_upgrade") {
          const target = result.policy.data?.upgrade_target || "";
          setActivation({ upgradeTarget: target });
          navigate("update");
          return;
        }
        setGateOk(true);
      })
      .catch(() => {
        // 复核失败（网络等）：不阻断，回退到前面步骤已落盘的结论
        if (!cancelled) setGateOk(null);
      });
    return () => {
      cancelled = true;
    };
  }, [navigate, setActivation, attempt]);

  // 前面的校验步骤已把结论写入配置；复核失败时以它为准
  const activatedFromSteps = activation.deviceOk && activation.versionOk;
  const ready = gateOk === true || (gateOk === null && activatedFromSteps);

  // 兜底：长时间未就绪时给出重新校验入口，避免停在无法继续的状态
  useEffect(() => {
    if (ready) {
      setShowRetry(false);
      return;
    }
    const t = setTimeout(() => setShowRetry(true), 5000);
    return () => clearTimeout(t);
  }, [ready]);

  const handleFinish = () => {
    setOobe(false);
    navigate("home");
  };

  return (
    <OobeLayout>
      <div className="flex flex-col items-center gap-6">
        <AppleHelloEnglishEffect className="text-foreground" />
      </div>

      <div className="absolute bottom-12 flex flex-col items-center gap-3">
        {!ready && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            正在完成激活校验...
          </span>
        )}
        {!ready && showRetry && (
          <button
            onClick={() => setAttempt((n) => n + 1)}
            className="text-[12px] text-foreground/40 hover:text-foreground/70 transition-colors cursor-pointer"
          >
            重新校验
          </button>
        )}
        <button
          onClick={handleFinish}
          disabled={!ready}
          className="h-12 px-6 rounded-full bg-foreground/[0.06] hover:bg-foreground/[0.12] flex items-center justify-center text-foreground/60 hover:text-foreground transition-opacity duration-700 ease-out text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ opacity: btnVisible && ready ? 1 : 0, pointerEvents: btnVisible && ready ? "auto" : "none" }}
        >
          前往首页
        </button>
      </div>
    </OobeLayout>
  );
}
