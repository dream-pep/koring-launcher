import { useEffect, useState } from "react";
import { useRouteStore } from "@/stores/routeStore";
import { OobeLayout } from "./layout";
import { SettingCard } from "@/components/setting";
import { Button } from "@heroui/react";
import { Loader2, ArrowLeft } from "lucide-react";

interface AgreementTextViewProps {
  /** public/ 下的协议文本文件 */
  file: string;
  title: string;
  subtitle: string;
}

/** 协议完整内容子页（从「确认产品协议」折叠项跳入，可返回协议列表） */
function AgreementTextView({ file, title, subtitle }: AgreementTextViewProps) {
  const navigate = useRouteStore((s) => s.navigate);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`${import.meta.env.BASE_URL}${file}`)
      .then((r) => r.text())
      .then((t) => {
        if (!cancelled) setText(t);
      })
      .catch(() => {
        if (!cancelled) setText("无法加载协议内容，请稍后重试。");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [file]);

  return (
    <OobeLayout>
      <div className="w-full max-w-2xl flex flex-col items-center gap-4 px-6">
        <div className="text-center space-y-1">
          <h2 className="text-lg font-bold text-foreground">{title}</h2>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>

        <SettingCard className="w-full h-[52vh] overflow-y-auto overscroll-contain animate-list-item-in">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-foreground/40" />
            </div>
          ) : (
            <pre className="text-xs text-foreground/70 whitespace-pre-wrap font-sans leading-relaxed">
              {text}
            </pre>
          )}
        </SettingCard>
      </div>

      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-10">
        <Button
          variant="outline"
          size="sm"
          onPress={() => navigate("oobe/agreement")}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          返回协议列表
        </Button>
      </div>
    </OobeLayout>
  );
}

/** 用户协议与免责声明（public/protocol-user.txt） */
export function OobeAgreementUser() {
  return (
    <AgreementTextView
      file="protocol-user.txt"
      title="用户协议与免责声明"
      subtitle="Koring Team 产品用户协议"
    />
  );
}

/** Koring APP Beta 测试协议（public/protocol-beta.txt） */
export function OobeAgreementBeta() {
  return (
    <AgreementTextView
      file="protocol-beta.txt"
      title="Koring APP Beta 测试协议"
      subtitle="参与 Beta 测试前请阅读以下协议"
    />
  );
}
