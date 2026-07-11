import { useState, useEffect } from "react";
import { useRouteStore } from "@/stores/routeStore";
import { OobeLayout } from "./layout";
import { NextButton } from "./next-button";

export function OobeAgreement() {
  const navigate = useRouteStore((s) => s.navigate);
  const [text, setText] = useState("");
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}protocol-user.txt`)
      .then((r) => r.text())
      .then(setText)
      .catch(() => setText("无法加载协议内容"));
  }, []);

  return (
    <OobeLayout>
      <div className="w-full max-w-lg flex flex-col items-center gap-4 px-6">
        {/* 标题 */}
        <div className="text-center space-y-1">
          <h2 className="text-lg font-bold text-foreground">Koring Team 产品用户协议</h2>
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
            我已详细阅读此协议，且同意其内容并签署此协议。
          </span>
        </label>
      </div>

      <NextButton onClick={() => navigate("oobe/version")} disabled={!checked} />
    </OobeLayout>
  );
}
