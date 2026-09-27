import { useCallback, useEffect, useRef, useState } from "react";
import { useRouteStore } from "@/stores/routeStore";
import { useConfigStore } from "@/stores/configStore";
import { launcherDeviceCheck } from "@/api/launcher-api";
import { ShieldAlert, RefreshCw, Loader2 } from "lucide-react";

/**
 * 设备异常（黑名单）阻断页。
 *
 * - 独立的整页界面（不是遮罩）：顶栏为 blocked 模式 —— 不显示胶囊菜单、任务队列与返回按钮，
 *   只保留品牌与窗口控制（最小化/最大化/关闭）；
 * - 该状态下不允许离开本页（除调试页与「重试」解除后），由下面的路由守卫兜住；
 * - 重试：重新查询设备状态，若已解除黑名单则回到 OOBE 设备校验步骤（OOBE 未完成时）
 *   或首页（OOBE 已完成）。
 */
export function DeviceBlocked() {
  const navigate = useRouteStore((s) => s.navigate);
  const setActivation = useConfigStore((s) => s.setActivation);
  const reason = useConfigStore((s) => s.config.activation.reason);
  const oobePending = useConfigStore((s) => s.config.oobe);

  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  /** 允许离开（重试通过后放行，避免被本页守卫拉回） */
  const leavingRef = useRef(false);

  const goNext = useCallback(() => {
    leavingRef.current = true;
    navigate(oobePending ? "oobe/device" : "home");
  }, [navigate, oobePending]);

  const retry = async () => {
    setChecking(true);
    setError("");
    try {
      const data = await launcherDeviceCheck();
      if (data.blacklisted) {
        setActivation({
          deviceOk: false,
          checkedAt: Date.now(),
          reason: data.blacklist?.reason ?? "设备已被拉黑",
        });
        setError("");
      } else {
        setActivation({ deviceOk: true, checkedAt: Date.now(), reason: "" });
        goNext();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setChecking(false);
    }
  };

  // 阻断守卫：本页状态下任何导航（调试页除外）都被拉回本页
  useEffect(() => {
    const redirect = () => {
      if (leavingRef.current) return;
      const key = useRouteStore.getState().current;
      if (key !== "device-blocked" && !key.startsWith("debug")) {
        navigate("device-blocked");
      }
    };
    redirect();
    return useRouteStore.subscribe(redirect);
  }, [navigate]);

  return (
    <div className="h-full flex flex-col items-center justify-center px-8">
      <div className="w-full max-w-lg flex flex-col items-center gap-4 text-center">
        <ShieldAlert className="w-16 h-16 text-red-500" />
        <h2 className="text-xl font-bold text-foreground">设备异常</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          此设备信息异常，激活失败。原因：{reason || "设备已被拉黑"}
        </p>

        {error && (
          <p className="text-xs text-amber-500 break-words">重新校验失败：{error}</p>
        )}

        <button
          onClick={() => void retry()}
          disabled={checking}
          className="flex items-center gap-1.5 h-9 px-4 rounded-lg text-[13px] font-medium bg-foreground/[0.06] hover:bg-foreground/[0.12] text-foreground/70 hover:text-foreground transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {checking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          {checking ? "正在重新校验..." : "重试"}
        </button>

        <p className="text-xs text-muted-foreground/60 leading-relaxed max-w-sm">
          如认为这是误判，请携带本机设备信息联系客服处理；解除拉黑后点击「重试」即可继续。
        </p>
      </div>
    </div>
  );
}
