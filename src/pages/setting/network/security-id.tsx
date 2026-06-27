import { useCallback } from "react";
import { useConfigStore } from "@/stores/configStore";
import { Switch } from "@/components/ui/switch";
import { ShieldCheck } from "lucide-react";

function GlassCard({ children }: { children: React.ReactNode }) {
  return <div className="glass-card px-5 py-4">{children}</div>;
}

function SettingRow({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {desc && <p className="text-[13px] text-muted-foreground mt-0.5">{desc}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function SecurityIdSetting() {
  const enabled = useConfigStore((s) => s.config.network.securityId.enabled);
  const authUrl = useConfigStore((s) => s.config.network.securityId.authUrl);
  const setNetwork = useConfigStore((s) => s.setNetwork);

  const handleToggle = useCallback((v: boolean) => {
    setNetwork({ securityId: { enabled: v, authUrl: "" } });
  }, [setNetwork]);

  const handleUrlChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setNetwork({ securityId: { enabled: true, authUrl: e.target.value } });
  }, [setNetwork]);

  return (
    <div>
      <h2 className="text-xl font-bold text-foreground mb-1">安全识别服务</h2>
      <p className="text-sm text-muted-foreground mb-6">管理账户安全验证、设备识别与登录保护</p>

      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-bold text-foreground mb-3">认证服务</h3>
          <div className="space-y-3">
            <GlassCard>
              <SettingRow
                label="启用第三方认证"
                desc="使用自定义认证服务器替代 Microsoft 认证（适用于离线服务器）"
              >
                <Switch checked={enabled} onCheckedChange={handleToggle} />
              </SettingRow>
            </GlassCard>

            {enabled && (
              <GlassCard>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">认证服务器 URL</p>
                  <p className="text-[13px] text-muted-foreground">输入第三方认证服务的地址</p>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-muted-foreground shrink-0" />
                    <input
                      type="text"
                      value={authUrl}
                      onChange={handleUrlChange}
                      placeholder="https://auth.example.com"
                      className="flex-1 h-8 px-3 rounded-md border border-input bg-background text-sm font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                </div>
              </GlassCard>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
