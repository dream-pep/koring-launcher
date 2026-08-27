import { useCallback } from "react";
import { useConfigStore } from "@/stores/configStore";
import { Switch, Input } from "@heroui/react";
import { ShieldCheck } from "lucide-react";
import { SettingCard, SettingRow, PageHeader, SectionTitle, fieldCls } from "@/components/setting";

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
      <PageHeader title="安全识别服务" desc="管理账户安全验证、设备识别与登录保护" />

      <div className="space-y-6">
        <div>
          <SectionTitle>认证服务</SectionTitle>
          <div className="space-y-3">
            <SettingCard>
              <SettingRow
                label="启用第三方认证"
                desc="使用自定义认证服务器替代 Microsoft 认证（适用于离线服务器）"
              >
                <Switch isSelected={enabled} onChange={handleToggle}>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch>
              </SettingRow>
            </SettingCard>

            {enabled && (
              <SettingCard>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">认证服务器 URL</p>
                  <p className="text-[13px] text-muted-foreground">输入第三方认证服务的地址</p>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-muted-foreground shrink-0" />
                    <Input
                      value={authUrl}
                      onChange={handleUrlChange}
                      placeholder="https://auth.example.com"
                      fullWidth
                      className={fieldCls}
                    />
                  </div>
                </div>
              </SettingCard>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
