import { useCallback, useEffect, useState } from "react";
import { useRouteStore } from "@/stores/routeStore";
import { useConfigStore } from "@/stores/configStore";
import { launcherVersionPolicy, launcherEnvInfo, type VersionPolicyResult } from "@/api/launcher-api";
import { VERSION } from "@/lib/version";
import { Loader2, Ban, ArrowUpCircle, RefreshCw } from "lucide-react";

type CheckState = "checking" | "blocked" | "upgrade" | "error";

function channelLabel(channel: VersionPolicyResult["channel"]): string {
  switch (channel) {
    case "stable":
      return "正式版";
    case "beta":
      return "测试版";
    case "legacy":
      return "旧版本号格式";
    default:
      return "未登记";
  }
}

interface VersionActivationPanelProps {
  /** 校验通过时回调（父页面直接进入下一步；通过时不展示任何「正常」提示） */
  onPassed: () => void;
}

/**
 * 程序版本激活校验面板（OOBE 与 UPVP 共用，Account API /launcher/version）：
 * - activation_blocked → 展示「不允许激活」+ 禁激活原因 + 版本情况，只可重试；
 * - 需要升级（force_upgrade 或低于 min_upgrade_version）→ 唯一出路是跳转版本更新页，
 *   并按要求的目标版本升级；
 * - 通过 → 写入 activation.versionOk 后**立即进入下一步**（不显示成功页）；
 * - 请求失败 → 展示原因 + 重试，不允许继续（严格策略；未打包的开发模式可跳过）。
 */
export function VersionActivationPanel({ onPassed }: VersionActivationPanelProps) {
  const navigate = useRouteStore((s) => s.navigate);
  const setActivation = useConfigStore((s) => s.setActivation);

  const [state, setState] = useState<CheckState>("checking");
  const [policy, setPolicy] = useState<VersionPolicyResult | null>(null);
  const [error, setError] = useState("");
  /** 是否打包产物（false=开发模式：服务不可用时可跳过，避免锁死开发环境） */
  const [enforced, setEnforced] = useState(true);

  const run = useCallback(async () => {
    setState("checking");
    setError("");
    try {
      const env = await launcherEnvInfo().catch(() => null);
      if (env) setEnforced(env.enforced);
      const data = await launcherVersionPolicy(VERSION);
      setPolicy(data);

      if (data.activation_blocked) {
        setState("blocked");
        setActivation({
          versionOk: false,
          checkedAt: Date.now(),
          version: VERSION,
          reason: data.block_reason || "该版本已被禁止激活",
        });
        return;
      }

      if (data.needs_upgrade) {
        setState("upgrade");
        setActivation({
          versionOk: false,
          checkedAt: Date.now(),
          version: VERSION,
          reason: "",
          upgradeTarget: data.upgrade_target || data.latest_stable || "",
        });
        return;
      }

      // 通过：不渲染成功页，直接交回父页面进入下一步
      setActivation({
        versionOk: true,
        checkedAt: Date.now(),
        version: VERSION,
        reason: "",
        upgradeTarget: "",
      });
      onPassed();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setPolicy(null);
      setError(message);
      setState("error");
      setActivation({ versionOk: false, checkedAt: Date.now(), version: VERSION, reason: message });
    }
  }, [onPassed, setActivation]);

  useEffect(() => {
    void run();
    // 仅挂载时执行一次；重试由按钮触发
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const retryButton = (
    <button
      onClick={() => void run()}
      className="flex items-center gap-1.5 h-9 px-4 rounded-lg text-[13px] font-medium bg-foreground/[0.06] hover:bg-foreground/[0.12] text-foreground/70 hover:text-foreground transition-colors cursor-pointer"
    >
      <RefreshCw className="w-3.5 h-3.5" />
      重试
    </button>
  );

  /** 版本情况（禁激活 / 升级页共用） */
  const versionFacts = (
    <div className="text-xs text-muted-foreground space-y-1 font-mono">
      <p>当前版本：{VERSION}</p>
      <p>
        版本渠道：{channelLabel(policy?.channel ?? null)}
        {policy?.is_legacy ? "（旧格式）" : ""}
      </p>
      <p>版本登记：{policy?.known ? "已登记" : "未登记"}</p>
      {policy?.latest_stable && <p>最新正式版：{policy.latest_stable}</p>}
      {policy?.latest_beta && <p>最新测试版：{policy.latest_beta}</p>}
    </div>
  );

  // 校验中（含通过后等待路由切换的一帧）：只显示进度，不显示结果
  if (state === "checking") {
    return (
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-foreground/40" />
        <span className="text-sm text-muted-foreground">正在确认版本信息，并激活...</span>
      </div>
    );
  }

  if (state === "blocked") {
    return (
      <div className="w-full max-w-lg flex flex-col items-center gap-4 px-6 text-center">
        <Ban className="w-14 h-14 text-red-500" />
        <div className="space-y-2">
          <h2 className="text-lg font-bold text-foreground">不允许激活</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            当前版本不允许激活。原因：{policy?.block_reason || "该版本已被禁止激活"}
          </p>
        </div>
        <div className="w-full rounded-xl bg-foreground/[0.03] border border-border/40 px-4 py-3 text-left">
          {versionFacts}
        </div>
        {retryButton}
      </div>
    );
  }

  if (state === "upgrade") {
    const target = policy?.upgrade_target || policy?.latest_stable || "";
    return (
      <div className="w-full max-w-lg flex flex-col items-center gap-4 px-6 text-center">
        <ArrowUpCircle className="w-14 h-14 text-amber-500" />
        <div className="space-y-2">
          <h2 className="text-lg font-bold text-foreground">需要升级后才能激活</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {target
              ? `当前版本需要升级至 v${target} 或更高版本，请前往版本更新页面完成升级。`
              : "当前版本已被要求强制升级，请前往版本更新页面升级至最新版本。"}
          </p>
        </div>
        <div className="w-full rounded-xl bg-foreground/[0.03] border border-border/40 px-4 py-3 text-left">
          {versionFacts}
          {target && <p className="text-xs text-muted-foreground font-mono mt-1">要求版本：{target}</p>}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("update")}
            className="h-9 px-4 rounded-lg text-[13px] font-semibold text-white bg-amber-500 hover:bg-amber-600 transition-colors cursor-pointer"
          >
            前往版本更新
          </button>
          {retryButton}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg flex flex-col items-center gap-4 px-6 text-center">
      <Ban className="w-14 h-14 text-amber-500" />
      <div className="space-y-2">
        <h2 className="text-lg font-bold text-foreground">版本校验失败</h2>
        <p className="text-sm text-muted-foreground leading-relaxed break-words">{error}</p>
      </div>
      {retryButton}
      {/* 开发模式（未打包）才出现的逃生口：校验服务不可用时不把开发环境锁死在流程里。
          打包产物 enforced=true，只显示重试。 */}
      {!enforced && (
        <button
          onClick={() => {
            setActivation({
              versionOk: true,
              checkedAt: Date.now(),
              version: VERSION,
              reason: "",
              upgradeTarget: "",
            });
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
