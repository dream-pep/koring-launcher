import { useState } from "react";
import { useRouteStore } from "@/stores/routeStore";
import { OobeLayout } from "./layout";
import { NextButton } from "./next-button";
import { SettingCard } from "@/components/setting";
import { Button } from "@heroui/react";
import { Check, ChevronDown, ExternalLink } from "lucide-react";

const LICENSE_URL = "https://support.lingke.ink/Koring/系列产品分发有限许可";
const USER_AGREEMENT_URL = "https://support.lingke.ink/Koring/系列产品用户协议与免责声明";

interface AgreementItem {
  key: string;
  title: string;
  summary: string;
  /** 跳转子页面（站内文本） */
  view?: () => void;
  /** 在浏览器中打开 */
  external?: string;
}

/** 测试协议签署：统一折叠的卡片列表，沿用设置页卡片样式。 */
export function OobeAgreement() {
  const navigate = useRouteStore((s) => s.navigate);
  const [agreed, setAgreed] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const items: AgreementItem[] = [
    {
      key: "user",
      title: "用户协议与免责声明",
      summary: "使用 Koring 启动器前请阅读并充分理解服务内容、用户义务与免责条款。",
      view: () => navigate("oobe/agreement-user"),
      external: USER_AGREEMENT_URL,
    },
    {
      key: "license",
      title: "产品分发有限许可",
      summary: "本产品仅限个人使用，未经许可不得进行二次分发、修改或商业使用。",
      external: LICENSE_URL,
    },
    {
      key: "beta",
      title: "Koring APP Beta 测试协议",
      summary: "测试版本可能存在不稳定或数据异常，请知悉并自愿参与测试计划。",
      view: () => navigate("oobe/agreement-beta"),
    },
    {
      key: "legal",
      title: "法律信息与隐私声明",
      summary: "了解我们的数据收集范围、存储方式与使用目的。",
      view: () => navigate("oobe/legal"),
    },
  ];

  return (
    <OobeLayout>
      <div className="w-full max-w-md flex flex-col items-center gap-2.5 px-6">
        <div className="text-center space-y-1 mb-1">
          <h2 className="text-lg font-bold text-foreground">协议与隐私</h2>
          <p className="text-xs text-muted-foreground">请阅读并同意以下内容以继续使用</p>
        </div>

        {items.map((item, i) => {
          const expanded = open === item.key;
          return (
            <div
              key={item.key}
              className="w-full animate-list-item-in"
              style={{ animationDelay: `${i * 45}ms` }}
            >
              <SettingCard className="w-full">
                <button
                  onClick={() => setOpen(expanded ? null : item.key)}
                  className="w-full flex items-center justify-between gap-4 text-left"
                >
                  <span className="text-sm font-medium text-foreground">{item.title}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-muted-foreground/60 shrink-0 transition-transform duration-200 ${
                      expanded ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {expanded && (
                  <div className="animate-list-item-in mt-3 pt-3 space-y-2.5 border-t border-black/[0.05] dark:border-white/[0.06]">
                    <p className="text-[12.5px] leading-relaxed text-muted-foreground">{item.summary}</p>
                    <div className="flex flex-wrap gap-2">
                      {item.view && (
                        <Button variant="outline" size="sm" onPress={item.view}>
                          查看完整协议
                        </Button>
                      )}
                      {item.external && (
                        <Button
                          variant="outline"
                          size="sm"
                          onPress={() => window.electronAPI?.openExternal(item.external as string)}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          在浏览器中打开
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </SettingCard>
            </div>
          );
        })}

        <label
          className="animate-list-item-in w-full flex items-start gap-3 cursor-pointer select-none mt-1 px-1"
          style={{ animationDelay: `${items.length * 45}ms` }}
        >
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="sr-only"
            aria-label="同意协议"
          />
          <span
            className={`mt-0.5 w-4 h-4 rounded-[5px] border shrink-0 flex items-center justify-center transition-colors ${
              agreed ? "bg-primary border-primary" : "border-border/60 bg-white/60 dark:bg-black/30"
            }`}
          >
            {agreed && <Check className="w-3 h-3 text-primary-foreground" strokeWidth={3} />}
          </span>
          <span className="text-[12.5px] leading-relaxed text-muted-foreground">
            我已阅读并同意上述协议，并自愿承担由此产生的相关责任。
          </span>
        </label>
      </div>

      {/* 同意协议后进入设备与版本校验 */}
      <NextButton disabled={!agreed} onClick={() => navigate("oobe/check")} />
    </OobeLayout>
  );
}
