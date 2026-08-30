import { useState, useEffect } from "react";
import { useRouteStore } from "@/stores/routeStore";
import { UpvpLayout } from "./layout";
import { NextButton } from "./next-button";
import { Loader2 } from "lucide-react";

/** 第三步：Beta 测试协议（仅测试版更新需要同意；框架与 OOBE 一致） */
export function UpvpBetaTest() {
  const navigate = useRouteStore((s) => s.navigate);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetch(`${import.meta.env.BASE_URL}protocol-beta.txt`)
        .then((r) => r.text())
        .then(setText)
        .catch(() => setText("无法加载协议内容"))
        .finally(() => setLoading(false));
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <UpvpLayout>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-foreground/40" />
          <span className="text-sm text-muted-foreground">正在确认版本信息，并激活...</span>
        </div>
      </UpvpLayout>
    );
  }

  return (
    <UpvpLayout>
      <div className="w-full max-w-lg flex flex-col items-center gap-4 px-6">
        {/* 标题 */}
        <div className="text-center space-y-1">
          <h2 className="text-lg font-bold text-foreground">Koring APP Beta 测试协议</h2>
          <p className="text-xs text-muted-foreground">您需要同意才可以继续</p>
        </div>

        {/* 协议内容 */}
        <div className="w-full h-[300px] rounded-xl bg-foreground/[0.03] border border-border/50 p-4 overflow-y-auto">
          <pre className="text-xs text-foreground/70 whitespace-pre-wrap font-sans leading-relaxed">
            {text}
          </pre>
        </div>

        {/* 勾选框 */}
        <label className="flex items-start gap-2.5 cursor-pointer select-none group">
          <div className="relative mt-0.5">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-4 h-4 rounded border border-border/60 bg-foreground/[0.03] peer-checked:bg-primary peer-checked:border-primary transition-colors flex items-center justify-center">
              {checked && (
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="2 6 5 9 10 3" />
                </svg>
              )}
            </div>
          </div>
          <span className="text-xs text-muted-foreground leading-relaxed group-hover:text-foreground/70 transition-colors">
            我已详细阅读并了解此 测试 协议，且 同意其内容 并 签署此协议。
          </span>
        </label>
      </div>

      <NextButton onClick={() => navigate("upvp/finish")} disabled={!checked} />
    </UpvpLayout>
  );
}
