import { useState, useEffect } from "react";
import { useRouteStore } from "@/stores/routeStore";
import { useKoringAuthStore } from "@/stores/koringAuthStore";
import { OobeLayout } from "./layout";
import { NextButton } from "./next-button";

export function OobeWelcome() {
  const navigate = useRouteStore((s) => s.navigate);
  const user = useKoringAuthStore((s) => s.user);
  const [showBtn, setShowBtn] = useState(false);
  const [animClass, setAnimClass] = useState("scale-90 opacity-0");

  useEffect(() => {
    requestAnimationFrame(() => {
      setAnimClass("scale-100 opacity-100");
    });
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setShowBtn(true), 1500);
    return () => clearTimeout(t);
  }, []);

  const displayName = user?.name || user?.username || "玩家";

  return (
    <OobeLayout>
      <div className="flex flex-col items-center gap-4">
        <h2
          className={`text-4xl font-bold text-foreground transition-all duration-700 ease-out ${animClass}`}
        >
          欢迎回来，{displayName}。
        </h2>
        {user?.sub && (
          <p className="text-xs text-muted-foreground font-mono">
            UUID: {user.sub}
          </p>
        )}
      </div>

      {showBtn && <NextButton onClick={() => navigate("oobe/version")} />}
    </OobeLayout>
  );
}
