import { useEffect, useState } from "react";
import { GlassCard, PageHeader } from "./components";
import { Button } from "@/components/ui/button";
import { useRouteStore } from "@/stores/routeStore";
import { useConfigStore } from "@/stores/configStore";
import { useDeveloperModeStore } from "@/stores/developerModeStore";
import { VERSION } from "@/lib/version";
import {
  launcherDeviceCheck,
  launcherDeviceNotifications,
  launcherDeviceReport,
  launcherDeviceStatus,
  launcherDeviceUuid,
  launcherEnvInfo,
  launcherStartupCheck,
  launcherVersionPolicy,
  type LauncherEnvInfo,
  type SmbiosUuidResult,
} from "@/api/launcher-api";
import { Loader2 } from "lucide-react";

interface CallLog {
  label: string;
  ok: boolean;
  detail: string;
  ms: number;
}

/** 激活校验测试：环境 / 配置状态 / 四个接口直调 / 启动门禁 / 校验页直达 */
export function ActivationDebug() {
  const navigate = useRouteStore((s) => s.navigate);
  const activation = useConfigStore((s) => s.config.activation);
  const setActivation = useConfigStore((s) => s.setActivation);

  const [env, setEnv] = useState<LauncherEnvInfo | null>(null);
  const [uuid, setUuid] = useState<SmbiosUuidResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [logs, setLogs] = useState<CallLog[]>([]);
  const developerMode = useDeveloperModeStore((s) => s.enabled);

  const refreshEnv = async () => {
    try {
      setEnv(await launcherEnvInfo());
    } catch {
      setEnv(null);
    }
    try {
      setUuid(await launcherDeviceUuid());
    } catch {
      setUuid(null);
    }
  };

  useEffect(() => {
    void refreshEnv();
    // 仅挂载时读取一次；env/api_base 变更需重启进程
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 统一执行 + 记录（结果以 JSON 折叠文本展示，便于对照接口契约） */
  const call = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(true);
    const started = Date.now();
    try {
      const data = await fn();
      // 设备类接口都带 developer_mode：调试页顺带同步到 store（无冷却，方便反复验证）
      const dev = (data as { developer_mode?: unknown } | null)?.developer_mode;
      if (typeof dev === "boolean") useDeveloperModeStore.getState().apply(dev);
      setLogs((prev) => [
        { label, ok: true, detail: JSON.stringify(data, null, 2), ms: Date.now() - started },
        ...prev,
      ]);
    } catch (e) {
      setLogs((prev) => [
        {
          label,
          ok: false,
          detail: e instanceof Error ? e.message : String(e),
          ms: Date.now() - started,
        },
        ...prev,
      ]);
    } finally {
      setBusy(false);
    }
  };

  const formatTime = (ts: number) => (ts > 0 ? new Date(ts).toLocaleString() : "—");

  return (
    <div className="max-w-2xl mx-auto p-8 space-y-6">
      <PageHeader
        title="激活校验测试"
        desc="设备状态 / 设备上报 / 版本策略 / 启动门禁的直调与页面预览（Account API）"
      />

      {/* 1. 环境 */}
      <div>
        <h3 className="text-sm font-semibold text-foreground/40 uppercase tracking-wider mb-3">
          环境
        </h3>
        <GlassCard>
          <div className="space-y-1.5 text-[13px] font-mono">
            <p className="flex justify-between gap-4">
              <span className="text-muted-foreground shrink-0">服务地址</span>
              <span className="truncate">{env?.api_base || "未配置（检查 .env）"}</span>
            </p>
            <p className="flex justify-between gap-4">
              <span className="text-muted-foreground shrink-0">是否强制阻断</span>
              <span>{env ? (env.enforced ? "是（打包产物 / KORING_ENFORCE=1）" : "否（开发模式，仅查询不拦）") : "-"}</span>
            </p>
            <p className="flex justify-between gap-4">
              <span className="text-muted-foreground shrink-0">界面版本</span>
              <span>{VERSION}</span>
            </p>
            <p className="flex justify-between gap-4">
              <span className="text-muted-foreground shrink-0">设备 uuid</span>
              <span className="truncate">
                {uuid ? `${uuid.uuid || "（未取到）"} · ${uuid.source}` : "-"}
              </span>
            </p>
            <p className="flex justify-between gap-4">
              <span className="text-muted-foreground shrink-0">开发者模式</span>
              <span>
                {developerMode
                  ? "开启（设置页显示「开发者选项」入口）"
                  : "关闭（设置页隐藏「开发者选项」入口）"}
              </span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <Button size="sm" variant="outline" onClick={() => void refreshEnv()}>
              刷新环境
            </Button>
            <Button size="sm" variant="outline" onClick={() => void call("设备标识", () => launcherDeviceUuid())}>
              读取设备标识
            </Button>
          </div>
        </GlassCard>
      </div>

      {/* 2. 配置中的激活状态 */}
      <div>
        <h3 className="text-sm font-semibold text-foreground/40 uppercase tracking-wider mb-3">
          配置中的激活状态
        </h3>
        <GlassCard>
          <div className="space-y-1.5 text-[13px] font-mono">
            <p className="flex justify-between"><span className="text-muted-foreground">设备校验</span><span>{activation.deviceOk ? "通过" : "未通过"}</span></p>
            <p className="flex justify-between"><span className="text-muted-foreground">版本校验</span><span>{activation.versionOk ? "通过" : "未通过"}</span></p>
            <p className="flex justify-between"><span className="text-muted-foreground">最近校验</span><span>{formatTime(activation.checkedAt)}</span></p>
            <p className="flex justify-between"><span className="text-muted-foreground">记录版本</span><span>{activation.version || "—"}</span></p>
            <p className="flex justify-between gap-4"><span className="text-muted-foreground shrink-0">升级目标</span><span className="truncate">{activation.upgradeTarget || "—"}</span></p>
            <p className="flex justify-between gap-4 text-amber-500"><span className="text-muted-foreground shrink-0">原因</span><span className="truncate">{activation.reason || "—"}</span></p>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setActivation({
                  versionOk: false,
                  deviceOk: false,
                  checkedAt: 0,
                  version: "",
                  reason: "",
                  upgradeTarget: "",
                })
              }
            >
              清除激活状态
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setActivation({ deviceOk: true, versionOk: true, checkedAt: Date.now(), reason: "" })}
            >
              标记为已激活
            </Button>
          </div>
        </GlassCard>
      </div>

      {/* 3. 接口直调 */}
      <div>
        <h3 className="text-sm font-semibold text-foreground/40 uppercase tracking-wider mb-3">
          接口直调
        </h3>
        <GlassCard>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void call("设备校验（未登记自动上报）", () => launcherDeviceCheck())}>
              设备校验
            </Button>
            <Button size="sm" variant="outline" onClick={() => void call("GET /device/status", () => launcherDeviceStatus())}>
              查询设备状态
            </Button>
            <Button size="sm" variant="outline" onClick={() => void call("POST /device/report", () => launcherDeviceReport())}>
              上报设备信息
            </Button>
            <Button size="sm" variant="outline" onClick={() => void call("GET /device/notifications", () => launcherDeviceNotifications())}>
              设备通知
            </Button>
            <Button size="sm" variant="outline" onClick={() => void call("GET /launcher/version", () => launcherVersionPolicy(VERSION))}>
              版本策略
            </Button>
            <Button size="sm" variant="outline" onClick={() => void call("启动检查（走缓存）", () => launcherStartupCheck())}>
              启动检查
            </Button>
            <Button size="sm" variant="outline" onClick={() => void call("启动检查（force=true）", () => launcherStartupCheck(true))}>
              启动检查（强制）
            </Button>
          </div>
          <p className="mt-3 text-[12px] text-muted-foreground/70 leading-relaxed">
            上报使用 POST，其余为 GET；设备 uuid 取本机 SMBIOS UUID。开发模式（未打包）默认只查询不阻断，
            需要验证黑名单/禁激活的阻断 UI 时用 <span className="font-mono">KORING_ENFORCE=1</span> 启动；
            联调本地桩用 <span className="font-mono">KORING_API_BASE</span> 覆盖（两者都在 .env / 环境变量里）。
          </p>
        </GlassCard>
      </div>

      {/* 4. 校验页直达 */}
      <div>
        <h3 className="text-sm font-semibold text-foreground/40 uppercase tracking-wider mb-3">
          校验页直达
        </h3>
        <GlassCard>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => navigate("oobe/device")}>
              OOBE · 设备校验
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate("oobe/activation")}>
              OOBE · 版本激活
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate("upvp/device")}>
              UPVP · 设备校验
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate("upvp/activation")}>
              UPVP · 版本激活
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                // 预览阻断页（顶栏应无胶囊菜单 / 任务按钮 / 返回）；离开需走调试页或点「重试」通过
                setActivation({
                  deviceOk: false,
                  checkedAt: Date.now(),
                  reason: "调试预览：设备被拉黑",
                });
                navigate("device-blocked");
              }}
            >
              设备异常页预览
            </Button>
          </div>
          <p className="mt-3 text-[12px] text-muted-foreground/70">
            通过时这两个页面会直接翻到下一步；想看阻断/失败态就先断开网络或把版本策略改成禁激活/强制升级。
          </p>
        </GlassCard>
      </div>

      {/* 5. 调用记录 */}
      <div>
        <h3 className="text-sm font-semibold text-foreground/40 uppercase tracking-wider mb-3 flex items-center gap-2">
          调用记录
          {busy && <Loader2 className="w-3.5 h-3.5 animate-spin text-foreground/40" />}
        </h3>
        <GlassCard>
          {logs.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">还没有调用，点上面的按钮试试。</p>
          ) : (
            <div className="space-y-3">
              {logs.map((l, i) => (
                <div key={`${l.label}-${i}`} className="border-b border-border/40 last:border-0 pb-3 last:pb-0">
                  <p className="text-[13px] font-medium text-foreground flex items-center justify-between gap-3">
                    <span className="truncate">{l.label}</span>
                    <span className={l.ok ? "text-emerald-500 shrink-0" : "text-red-500 shrink-0"}>
                      {l.ok ? "成功" : "失败"} · {l.ms}ms
                    </span>
                  </p>
                  <pre className="mt-1 text-[12px] text-muted-foreground font-mono whitespace-pre-wrap break-all max-h-64 overflow-y-auto scroll-area">
                    {l.detail}
                  </pre>
                </div>
              ))}
              <div className="pt-1">
                <Button size="sm" variant="outline" onClick={() => setLogs([])}>
                  清空记录
                </Button>
              </div>
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
