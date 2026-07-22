import { useState } from "react";
import { useRouteStore } from "@/stores/routeStore";
import { OobeLayout } from "./layout";
import { NextButton } from "./next-button";
import { Check } from "lucide-react";

const languages = [
  { key: "zh-CN", label: "简体中文", available: true },
  { key: "zh-TW", label: "繁体中文", available: false },
  { key: "en", label: "English", available: false },
  { key: "ja", label: "日本語", available: false },
  { key: "ko", label: "한국어", available: false },
  { key: "lzh", label: "文言文（中国）", available: false },
];

export function OobeLanguage() {
  const navigate = useRouteStore((s) => s.navigate);
  const [selected, setSelected] = useState("zh-CN");

  return (
    <OobeLayout>
      <div className="w-full max-w-sm space-y-3">
        {languages.map((lang) => (
          <button
            key={lang.key}
            disabled={!lang.available}
            onClick={() => lang.available && setSelected(lang.key)}
            className={[
              "w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200",
              lang.available
                ? selected === lang.key
                  ? "bg-foreground/[0.08] text-foreground ring-1 ring-foreground/10"
                  : "bg-foreground/[0.03] text-foreground/60 hover:bg-foreground/[0.06] hover:text-foreground/80"
                : "bg-foreground/[0.02] text-foreground/25 cursor-not-allowed",
            ].join(" ")}
          >
            <span>{lang.label}</span>
            {!lang.available && (
              <span className="text-[11px] text-foreground/20">即将推出</span>
            )}
            {selected === lang.key && lang.available && (
              <Check className="w-4 h-4 text-foreground/60" />
            )}
          </button>
        ))}
      </div>

      <NextButton onClick={() => navigate("oobe/login")} />
    </OobeLayout>
  );
}
