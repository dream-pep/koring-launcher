import { useCallback, useEffect, useState } from "react";
import { useRouteStore } from "@/stores/routeStore";
import { useConfigStore } from "@/stores/configStore";
import { useOobeSetupStore } from "@/stores/oobeSetupStore";
import { useDeveloperModeStore } from "@/stores/developerModeStore";
import {
  launcherDeviceCheck,
  launcherVersionPolicy,
  launcherEnvInfo,
  type VersionPolicyResult,
} from "@/api/launcher-api";
import { VERSION } from "@/lib/version";
import { OobeLayout } from "./layout";
import { SettingCard, SettingRow } from "@/components/setting";
import { Button } from "@heroui/react";
import { Loader2, Ban, ArrowUpCircle, RefreshCw, CheckCircle2, XCircle } from "lucide-react";

type Phase = "checking" | "ok" | "blocked" | "upgrade" | "error";

interface SideState {
  status: "checking" | "ok" | "error";
  message?: string;
}

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

/** 校验状态指示 */
function StatusIndicator({ side }: { side: SideState }) {
  if (side.status === "checking") return <Loader2 className="w-4 h-4 animate-spin text-foreground/40" />;
  if (side.status === "ok") return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
  return <XCircle className="w-4 h-4 text-red-500" />;
}

/**
 * OOBE 激活校验步骤：**版本号与设备信息同时校验**（Promise.allSettled，同一服务并发）。
 * - 两端都通过 → 直接进入下一步（直接使用 → 快速上手；详细配置 → 外观模式），不显示「正常」提示；
 * - 设备黑名单 → 独立阻断页 device-blocked；
 * - 版本禁激活 → 展示原因 + 版本情况，可重试；
 * - 需要升级 → 唯一出路是强制升级页 forced-update；
 * - 请求失败 → 分项展示原因 + 重试（未打包的开发模式可跳过，避免锁死开发环境）。
 */
export function OobeCheck() {
  const navigate = useRouteStore((s) => s.navigate);
  const setActivation = useConfigStore((s) => s.setActivation);
  const setupMode = useOobeSetupStore((s) => s.mode);

  const [phase, setPhase] = useState<Phase>("checking");
  const [deviceSide, setDeviceSide] = useState<SideState>({ status: "checking" });
  const [versionSide, setVersionSide] = useState<SideState>({ status: "checking" });
  const [policy, setPolicy] = useState<VersionPolicyResult | null>(null);
  /** 是否打包产物（false=开发模式：服务不可用时可跳过） */
  const [enforced, setEnforced] = useState(true);

  const goNext = useCallback(() => {
    navigate(setupMode === "detailed" ? "oobe/theme" : "oobe/quickstart");
  }, [navigate, setupMode]);

  const run = useCallback(async () => {
    setPhase("checking");
    setDeviceSide({ status: "checking" });
    setVersionSide({ status: "checking" });
    setPolicy(null);

    const env = await launcherEnvInfo().catch(() => null);
    if (env) setEnforced(env.enforced);

    // 版本号与设备信息同时校验
    const [deviceRes, policyRes] = await Promise.allSettled([
      launcherDeviceCheck(),
      launcherVersionPolicy(VERSION),
    ]);

    // ---- 设备信息 ----
    if (deviceRes.status === "rejected") {
      const message = deviceRes.reason instanceof Error ? deviceRes.reason.message : String(deviceRes.reason);
      setDeviceSide({ status: "error", message });
      setActivation({ deviceOk: false, checkedAt: Date.now(), reason: message });
      setPhase("error");
      return;
    }
    const device = deviceRes.value;
    useDeveloperModeStore.getState().apply(device.developer_mode);
    if (device.blacklisted) {
      setActivation({
        deviceOk: false,
        checkedAt: Date.now(),
        reason: device.blacklist?.reason ?? "设备已被拉黑",
      });
      navigate("device-blocked");
      return;
    }
    setDeviceSide({ status: "ok" });
    setActivation({ deviceOk: true, checkedAt: Date.now(), reason: "" });

    // ---- 版本策略 ----
    if (policyRes.status === "rejected") {
      const message = policyRes.reason instanceof Error ? policyRes.reason.message : String(policyRes.reason);
      setVersionSide({ status: "error", message });
      setActivation({ versionOk: false, checkedAt: Date.now(), version: VERSION, reason: message });
      setPhase("error");
      return;
    }
    const p = policyRes.value;
    setPolicy(p);

    if (p.activation_blocked) {
      setVersionSide({ status: "error", message: p.block_reason || "该版本已被禁止激活" });
      setActivation({
        versionOk: false,
        checkedAt: Date.now(),
        version: VERSION,
        reason: p.block_reason || "该版本已被禁止激活",
      });
      setPhase("blocked");
      return;
    }

    if (p.needs_upgrade) {
      setVersionSide({ status: "error", message: "需要升级后才能激活" });
      setActivation({
        versionOk: false,
        checkedAt: Date.now(),
        version: VERSION,
        reason: "",
        upgradeTarget: p.upgrade_target || p.latest_stable || "",
      });
      setPhase("upgrade");
      return;
    }

    // 两端均通过 → 直接进入下一步
    setVersionSide({ status: "ok" });
    setActivation({
      versionOk: true,
      checkedAt: Date.now(),
      version: VERSION,
      reason: "",
      upgradeTarget: "",
    });
    setPhase("ok");
    goNext();
  }, [goNext, navigate, setActivation]);

  useEffect(() => {
    void run();
    // 仅在挂载时执行一次；重试由按钮触发
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 版本情况（禁激活 / 升级共用） */
  const versionFacts = (
    <div className="text-xs text-muted-foreground space-y-1 font-mono text-left">
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

  const retryButton = (
    <Button variant="outline" size="sm" onPress={() => void run()}>
      <RefreshCw className="w-3.5 h-3.5" />
      重试
    </Button>
  );

  /** 开发模式（未打包）逃生口：只对版本类失败开放，避免开发环境被锁死 */
  const devBypass = !enforced && (
    <Button
      variant="ghost"
      size="sm"
      onPress={() => {
        setActivation({
          versionOk: true,
          deviceOk: true,
          checkedAt: Date.now(),
          version: VERSION,
          reason: "",
          upgradeTarget: "",
        });
        goNext();
      }}
    >
      跳过校验（仅开发模式）
    </Button>
  );

  const checking = phase === "checking" || phase === "ok";

  return (
    <OobeLayout>
      <div className="w-full max-w-lg flex flex-col items-center gap-3 px-6">
        <div className="text-center space-y-1 mb-1">
          <h2 className="text-lg font-bold text-foreground">正在校验激活信息</h2>
          <p className="text-xs text-muted-foreground">版本号与设备信息将同时校验，请稍候</p>
        </div>

        <SettingCard className="w-full animate-list-item-in">
          <div className="space-y-3">
            <SettingRow label="设备信息" desc={deviceSide.status === "error" ? deviceSide.message || "校验失败" : undefined}>
              <StatusIndicator side={deviceSide} />
            </SettingRow>
            <SettingRow
              label="版本号"
              desc={versionSide.status === "error" ? versionSide.message || "校验失败" : undefined}
            >
              <StatusIndicator side={versionSide} />
            </SettingRow>
          </div>
        </SettingCard>

        {checking && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            正在与激活服务通信...
          </span>
        )}

        {phase === "blocked" && (
          <div className="w-full animate-pop-in">
            <SettingCard className="w-full">
              <div className="flex flex-col items-center gap-3 text-center">
                <Ban className="w-10 h-10 text-red-500" />
                <div className="space-y-1.5">
                  <h3 className="text-base font-bold text-foreground">不允许激活</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    当前版本不允许激活。原因：{policy?.block_reason || "该版本已被禁止激活"}
                  </p>
                </div>
                {versionFacts}
                <div className="flex items-center gap-2 pt-1">
                  {retryButton}
                  {devBypass}
                </div>
              </div>
            </SettingCard>
          </div>
        )}

        {phase === "upgrade" && (
          <div className="w-full animate-pop-in">
            <SettingCard className="w-full">
              <div className="flex flex-col items-center gap-3 text-center">
                <ArrowUpCircle className="w-10 h-10 text-amber-500" />
                <div className="space-y-1.5">
                  <h3 className="text-base font-bold text-foreground">需要升级后才能激活</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {policy?.upgrade_target || policy?.latest_stable
                      ? `当前版本需要升级至 v${policy?.upgrade_target || policy?.latest_stable} 或更高版本，点击下方按钮下载并安装。`
                      : "当前版本已被要求强制升级，点击下方按钮下载最新版本。"}
                  </p>
                </div>
                {versionFacts}
                <div className="flex items-center gap-2 pt-1">
                  <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white" onPress={() => navigate("forced-update")}>
                    立即升级
                  </Button>
                  {retryButton}
                </div>
                {devBypass}
              </div>
            </SettingCard>
          </div>
        )}

        {phase === "error" && (
          <div className="w-full animate-pop-in">
            <SettingCard className="w-full">
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="space-y-1.5">
                  <h3 className="text-base font-bold text-foreground">激活校验失败</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    校验服务暂时不可用或返回异常，请检查网络后重试。
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {retryButton}
                  {devBypass}
                </div>
              </div>
            </SettingCard>
          </div>
        )}
      </div>
    </OobeLayout>
  );
}
