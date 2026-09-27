import { useCallback, useEffect, useState } from "react";
import { useRouteStore } from "@/stores/routeStore";
import { useConfigStore } from "@/stores/configStore";
import { useDeveloperModeStore } from "@/stores/developerModeStore";
import { launcherDeviceCheck, launcherEnvInfo } from "@/api/launcher-api";
import { Loader2, ShieldAlert, RefreshCw } from "lucide-react";

type CheckState = "checking" | "error";

interface DeviceCheckPanelProps {
  /** 校验通过时回调（父页面直接进入下一步；通过时不展示任何「正常」提示） */
  onPassed: () => void;
}

/**
 * 设备状态校验面板（OOBE 语言页之后 / UPVP 更新完成页之后共用）：
 *   未登记设备 → 主进程自动上报一次（uuid = 本机 SMBIOS UUID）→ 上报成功且未被拉黑即通过；
 *   已登记且正常 → 通过 → **立即进入下一步**（不显示成功页）；
 *   黑名单 → 跳到独立的「设备异常」阻断页（device-blocked）；
 *   请求失败（断网/超时/鉴权失败）→ 显示原因并重试，**不允许继续**（严格策略）。
 */
export function DeviceCheckPanel({ onPassed }: DeviceCheckPanelProps) {
  const navigate = useRouteStore((s) => s.navigate);
  const setActivation = useConfigStore((s) => s.setActivation);
  const [state, setState] = useState<CheckState>("checking");
  const [error, setError] = useState<string>("");
  /** 是否打包产物（false=开发模式：服务不可用时可跳过，避免锁死开发环境） */
  const [enforced, setEnforced] = useState(true);

  const run = useCallback(async () => {
    setState("checking");
    setError("");
    try {
      const env = await launcherEnvInfo().catch(() => null);
      if (env) setEnforced(env.enforced);
      const data = await launcherDeviceCheck();
      // 服务端开发者模式开关（与启动门禁同一来源，任一查询成功即同步）
      useDeveloperModeStore.getState().apply(data.developer_mode);
      if (data.blacklisted) {
        setActivation({
          deviceOk: false,
          checkedAt: Date.now(),
          reason: data.blacklist?.reason ?? "设备已被拉黑",
        });
        // 黑名单统一落到独立的「设备异常」阻断页（顶栏无菜单/任务/返回，且不可离开）
        navigate("device-blocked");
        return;
      }
      // 通过：不渲染成功页，直接交回父页面进入下一步
      setActivation({ deviceOk: true, checkedAt: Date.now(), reason: "" });
      onPassed();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      setState("error");
      setActivation({ deviceOk: false, checkedAt: Date.now(), reason: message });
    }
  }, [navigate, onPassed, setActivation]);

  useEffect(() => {
    void run();
    // 仅在挂载时执行一次；重试由按钮触发
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 校验中（含通过后等待路由切换的一帧）：只显示进度，不显示结果
  if (state === "checking") {
    return (
      <div className="flex flex-col items-center gap-3 py-4">
        <Loader2 className="w-6 h-6 animate-spin text-foreground/40" />
        <span className="text-sm text-muted-foreground">正在校验设备状态...</span>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg flex flex-col items-center gap-4 px-6 text-center">
      <ShieldAlert className="w-14 h-14 text-amber-500" />
      <div className="space-y-2">
        <h2 className="text-lg font-bold text-foreground">设备校验失败</h2>
        <p className="text-sm text-muted-foreground leading-relaxed break-words">{error}</p>
      </div>
      <button
        onClick={() => void run()}
        className="flex items-center gap-1.5 h-9 px-4 rounded-lg text-[13px] font-medium bg-foreground/[0.06] hover:bg-foreground/[0.12] text-foreground/70 hover:text-foreground transition-colors cursor-pointer"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        重试
      </button>
      {/* 开发模式（未打包）才出现的逃生口：校验服务不可用时不把开发环境锁死在流程里。
          打包产物 enforced=true，只显示重试。 */}
      {!enforced && (
        <button
          onClick={() => {
            setActivation({ deviceOk: true, checkedAt: Date.now(), reason: "" });
            setState("checking");
            onPassed();
          }}
          className="text-[12px] text-foreground/35 hover:text-foreground/60 transition-colors cursor-pointer"
        >
          跳过校验（仅开发模式）
        </button>
      )}
    </div>
  );
}
