import { useEffect, useState } from "react";
import { useRouteStore } from "@/stores/routeStore";
import { useConfigStore } from "@/stores/configStore";
import { OobeLayout } from "./layout";
import { AppleHelloEnglishEffect } from "@/components/ui/apple-hello-effect";

export function OobeFinish() {
  const navigate = useRouteStore((s) => s.navigate);
  const setOobe = useConfigStore((s) => s.setOobe);

  // 「前往首页」按钮先隐藏，hello 动画播完后（4 秒）渐入浮现
  const [btnVisible, setBtnVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setBtnVisible(true), 4000);
    return () => clearTimeout(t);
  }, []);

  const handleFinish = () => {
    setOobe(false);
    navigate("home");
  };

  return (
    <OobeLayout>
      <div className="flex flex-col items-center gap-6">
        <AppleHelloEnglishEffect className="text-foreground" />
      </div>

      <div className="absolute bottom-12">
        <button
          onClick={handleFinish}
          className="h-12 px-6 rounded-full bg-foreground/[0.06] hover:bg-foreground/[0.12] flex items-center justify-center text-foreground/60 hover:text-foreground transition-opacity duration-700 ease-out text-sm font-medium"
          style={{ opacity: btnVisible ? 1 : 0, pointerEvents: btnVisible ? "auto" : "none" }}
        >
          前往首页
        </button>
      </div>
    </OobeLayout>
  );
}
