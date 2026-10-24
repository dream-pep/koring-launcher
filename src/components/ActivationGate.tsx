import { useEffect, useRef, useState } from "react";
import { toast } from "@/lib/toast";
import { useRouteStore } from "@/stores/routeStore";
import { useConfigStore } from "@/stores/configStore";
import { useDeveloperModeStore, refreshDeveloperMode } from "@/stores/developerModeStore";
import {
  launcherStartupCheck,
  type LauncherNotification,
  type StartupCheckResult,
} from "@/api/launcher-api";
import { VERSION } from "@/lib/version";
import { Ban, ArrowUpCircle, RefreshCw } from "lucide-react";

type Phase = "checking" | "ok" | "blocked" | "upgrade" | "error";

/** 「重试」最小间隔：避免连点/重挂载把 device_service 的共享限流桶打满 */
const MIN_RETRY_INTERVAL_MS = 1500;

/** 启动公告：常驻通知（不自动消失，需用户看到并处理；文档 §6.2 的公告语义） */
function showNotification(n: LauncherNotification) {
  const text = [n.publisher ? `${n.publisher}` : "", n.content ?? ""].filter(Boolean).join(" · ");
  const options = {
    // 固定 id 只用于同一次启动内去重（渲染进程每次启动都会重新挂载 → 每次启动都会弹）
    id: `startup-notice:${n.id}`,
    description: text || undefined,
    // 常驻 + 可关闭：公告不能被自动收起，但必须给用户关闭/处理入口
    duration: Infinity,
    closeButton: true,
    action: n.link_url
      ? { label: "查看详情", onClick: () => window.electronAPI?.openExternal(n.link_url as string) }
      : undefined,
  };
  // 保留级别配色语义：危险/漏洞 → error，警告 → warning，其余 → info
  switch (n.level) {
    case "danger":
    case "vulnerability":
      toast.error(n.title, options);
      break;
    case "warning":
      toast.warning(n.title, options);
      break;
    default:
      toast.info(n.title, options);
  }
}

/**
 * 启动通知 + 激活门禁（全局，RootLayout 挂载）。
 *
 * 1) 每次启动查一次「设备 + 版本」（同一个 device_service 服务），把两边的
 *    notifications 用 toast 展示出来 —— 每次启动都会显示，不做「已读」记忆。
 * 2) 门禁（判定见 electron/core/launcher-api.ts 的 startupCheck）：
 *    - **设备黑名单：任何构建形态、任何流程阶段都阻断**（每次进程启动都会查），
 *      显示「设备异常」+ 原因 + 有效期 + 重试；
 *    - 版本禁激活 / 强制升级：OOBE 未完成时交给 OOBE/UPVP 的校验步骤，
 *      OOBE 完成后（即进入日常使用）由这里兜住每次启动；
 *    - 请求失败（断网 / 超时 / 服务 5xx / 未配置）：不阻断，只提示 —— 避免服务不可用时
 *      启动器完全不可用。
 * 3) 未打包（开发）运行对「版本类阻断」提供跳过入口，避免后端改策略时锁死开发环境；
 *    设备黑名单不设豁免。
 */
export function ActivationGate() {
  const loaded = useConfigStore((s) => s.loaded);
  const oobePending = useConfigStore((s) => s.config.oobe);
  const upgradeTarget = useConfigStore((s) => s.config.activation.upgradeTarget);
  const setActivation = useConfigStore((s) => s.setActivation);
  const navigate = useRouteStore((s) => s.navigate);
  const currentRoute = useRouteStore((s) => s.current);

  const [phase, setPhase] = useState<Phase>("checking");
  const [result, setResult] = useState<StartupCheckResult | null>(null);
  const ranRef = useRef(false);
  /** 在途检查（并发合并）与上次强制重试时间（最小间隔） */
  const inFlightRef = useRef<Promise<void> | null>(null);
  const lastRunRef = useRef(0);

  const run = async (force = false) => {
    // 并发/密集重试合并：同一时刻只允许一个在途检查，且强制重试有最小间隔。
    // （门禁遮罩在重新挂载/连点时容易被反复触发，这里兜住，避免把共享限流桶打满）
    if (inFlightRef.current) return;
    if (force && Date.now() - lastRunRef.current < MIN_RETRY_INTERVAL_MS) return;
    lastRunRef.current = Date.now();
    const task = (async () => {
      setPhase("checking");
      // 标记「刚刚查过」：本次启动检查已覆盖设备状态（含 developer_mode），
      // 让启动瞬间的窗口 focus / 设置页挂载触发的 refreshDeveloperMode 落进退避窗口，
      // 避免同一秒内重复请求（限流桶是设备+版本共用的）
      useDeveloperModeStore.getState().markAttempted();
      try {
      const data = await launcherStartupCheck(force);
      setResult(data);

      // ---- 通知：每次启动都展示（设备维度 + 版本维度） ----
      const seen = new Set<string>();
      const all = [
        ...(data.device.data?.notifications ?? []),
        ...(data.policy.data?.notifications ?? []),
      ];
      for (const n of all) {
        if (!n?.id || seen.has(n.id)) continue;
        seen.add(n.id);
        showNotification(n);
      }
      if (!data.device.ok && data.device.error) {
        toast.warning("设备校验未完成", { description: data.device.error, duration: 8000, closeButton: true });
      }
      if (!data.policy.ok && data.policy.error) {
        toast.warning("版本校验未完成", { description: data.policy.error, duration: 8000, closeButton: true });
      }

      // ---- 开发者模式（服务端下发）：仅在查询成功时更新，避免接口抖动把入口弄消失 ----
      if (data.device.ok && data.device.data) {
        useDeveloperModeStore.getState().apply(data.device.data.developer_mode);
      }

      // ---- 门禁 ----
      // 1) 设备黑名单：**任何构建形态、任何流程阶段都阻断**（每次进程启动都会查一次）。
      //    阻断落到独立页面 device-blocked（顶栏无胶囊菜单/任务按钮/返回），
      //    由该页的路由守卫保证不可离开；这是服务端下发的事实，不设开发模式豁免。
      if (data.block === "device_blacklisted") {
        setPhase("ok");
        setActivation({
          deviceOk: false,
          checkedAt: Date.now(),
          reason: data.device.data?.blacklist?.reason ?? "设备已被拉黑",
        });
        navigate("device-blocked");
        return;
      }

      // 2) 版本类阻断（禁激活 / 强制升级）：OOBE 未完成时交给 OOBE/UPVP 里的校验步骤处理，
      //    避免与那两页重复弹层；OOBE 已完成则由这里兜住每次启动。
      if (oobePending) {
        setPhase("ok");
        return;
      }

      switch (data.block) {
        case "activation_blocked":
          setPhase("blocked");
          setActivation({
            versionOk: false,
            checkedAt: Date.now(),
            version: VERSION,
            reason: data.policy.data?.block_reason ?? "该版本已被禁止激活",
          });
          break;
        case "force_upgrade": {
          const target = data.policy.data?.upgrade_target || "";
          setActivation({ versionOk: false, checkedAt: Date.now(), version: VERSION, upgradeTarget: target });
          setPhase("upgrade");
          navigate("update");
          break;
        }
        default:
          // 校验通过：刷新激活状态并清掉遗留的升级目标
          setActivation({
            versionOk: true,
            ...(data.device.ok ? { deviceOk: true } : {}),
            checkedAt: Date.now(),
            version: VERSION,
            reason: "",
            upgradeTarget: "",
          });
          setPhase("ok");
      }
    } catch (e) {
      setResult(null);
      setPhase("error");
      toast.error("启动校验失败", {
        description: e instanceof Error ? e.message : String(e),
        duration: 8000,
        closeButton: true,
      });
    }
    })();
    inFlightRef.current = task;
    try {
      await task;
    } finally {
      inFlightRef.current = null;
    }
  };

  useEffect(() => {
    if (!loaded || ranRef.current) return;
    ranRef.current = true;
    void run();
    // 每次启动（页面加载）只跑一次；重试由按钮触发
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  /**
   * 开发者模式的追加刷新入口：窗口重新获得焦点 / 从后台切回可见时按需刷新
   * （内部有 5 分钟冷却 + 30 秒退避 + 在途合并，不会因反复切窗口而打爆限流）。
   */
  useEffect(() => {
    const onFocus = () => {
      void refreshDeveloperMode();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshDeveloperMode();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // 强制升级：升级完成前不允许离开版本更新页
  useEffect(() => {
    if (phase !== "upgrade") return;
    const current = useRouteStore.getState().current;
    if (current !== "update" && !current.startsWith("debug")) {
      navigate("update");
    }
    return useRouteStore.subscribe(() => {
      const key = useRouteStore.getState().current;
      if (key !== "update" && !key.startsWith("debug")) {
        navigate("update");
      }
    });
  }, [phase, navigate]);

  if (phase === "checking" || phase === "ok" || phase === "error") return null;

  const retryButton = (
    <button
      onClick={() => void run(true)}
      className="flex items-center gap-1.5 h-9 px-4 rounded-lg text-[13px] font-medium bg-foreground/[0.06] hover:bg-foreground/[0.12] text-foreground/70 hover:text-foreground transition-colors cursor-pointer"
    >
      <RefreshCw className="w-3.5 h-3.5" />
      重试
    </button>
  );

  // 强制升级：跳转到更新页后遮罩隐藏（由「不允许离开更新页」守卫继续约束）
  if (phase === "upgrade" && currentRoute === "update") return null;

  /**
   * 开发模式（未打包）才出现的逃生口：后端在改策略时不要把开发环境锁死。
   * 只对「版本类阻断」开放；设备黑名单不给豁免（那是服务端下发的事实，走 device-blocked 页）。
   */
  const devBypass = result?.enforced === false && (
    <button
      onClick={() => {
        setActivation({ versionOk: true, checkedAt: Date.now(), version: VERSION, reason: "", upgradeTarget: "" });
        setPhase("ok");
      }}
      className="text-[12px] text-foreground/35 hover:text-foreground/60 transition-colors cursor-pointer"
    >
      跳过校验（仅开发模式）
    </button>
  );

  return (
    <div className="fixed inset-0 z-[90] flex flex-col items-center justify-center gap-4 px-8 text-center bg-background/95 backdrop-blur-sm">
      {phase === "upgrade" ? (
        <>
          <ArrowUpCircle className="w-14 h-14 text-amber-500" />
          <h2 className="text-lg font-bold text-foreground">需要升级后才能继续</h2>
          <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
            {upgradeTarget
              ? `当前版本需要升级至 v${upgradeTarget} 或更高版本。`
              : "当前版本已被要求强制升级，请升级至最新版本。"}
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("update")}
              className="h-9 px-4 rounded-lg text-[13px] font-semibold text-white bg-amber-500 hover:bg-amber-600 transition-colors cursor-pointer"
            >
              前往版本更新
            </button>
            {retryButton}
          </div>
          {devBypass}
        </>
      ) : (
        <>
          <Ban className="w-14 h-14 text-red-500" />
          <h2 className="text-lg font-bold text-foreground">不允许激活</h2>
          <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
            当前版本（v{VERSION}）不允许激活。原因：
            {result?.policy.data?.block_reason || "该版本已被禁止激活"}
          </p>
          <div className="text-xs text-muted-foreground/80 font-mono space-y-1">
            <p>版本渠道：{result?.policy.data?.channel ?? "未知"}</p>
            {result?.policy.data?.latest_stable && <p>最新正式版：{result.policy.data.latest_stable}</p>}
          </div>
          {retryButton}
          {devBypass}
        </>
      )}
    </div>
  );
}
