import { useEffect, useState } from "react";
import { useRouteStore } from "@/stores/routeStore";
import { useConfigStore } from "@/stores/configStore";
import { VERSION } from "@/lib/version";
import { compareVersions } from "@/api/update";
import { UpvpLayout } from "./layout";
import { AppleHelloEnglishEffect } from "@/components/ui/apple-hello-effect";

/**
 * 第四步（结束）：与 OOBE 结束页一致。
 * 写入 appVersion 规则：
 * - 程序版本 > appVersion（正常升级）→ 更新 appVersion 为当前版本号
 * - 程序版本 < appVersion（版本倒退）→ 不修改，保持原样
 */
export function UpvpFinish() {
  const navigate = useRouteStore((s) => s.navigate);
  const appVersion = useConfigStore((s) => s.config.appVersion);
  const setAppVersion = useConfigStore((s) => s.setAppVersion);

  const [ready, setReady] = useState(false);
  const [shouldWrite, setShouldWrite] = useState(false);

  // 「前往首页」按钮先隐藏，hello 动画播完后（4 秒）渐入浮现
  const [btnVisible, setBtnVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setBtnVisible(true), 4000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    compareVersions(VERSION, appVersion)
      .then((r) => {
        if (cancelled) return;
        // 仅版本倒退（a<b）保持原样；相等/无效也写入（无害，值为当前版本）
        setShouldWrite(r.result !== "a<b");
      })
      .catch(() => {
        if (!cancelled) setShouldWrite(true);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [appVersion]);

  const handleFinish = () => {
    if (shouldWrite) {
      // 正常升级：记录当前版本到配置，下次启动程序版本与配置版本一致 → 正常进入主页
      setAppVersion(VERSION);
    }
    // 版本倒退：不修改 appVersion，下次启动仍会进入 upvp 提醒
    navigate("home");
  };

  return (
    <UpvpLayout>
      <div className="flex flex-col items-center gap-6">
        <AppleHelloEnglishEffect className="text-foreground" />
      </div>

      <div className="absolute bottom-12">
        <button
          onClick={handleFinish}
          disabled={!ready}
          className="h-12 px-6 rounded-full bg-foreground/[0.06] hover:bg-foreground/[0.12] flex items-center justify-center text-foreground/60 hover:text-foreground transition-opacity duration-700 ease-out text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ opacity: btnVisible ? (ready ? 1 : undefined) : 0, pointerEvents: btnVisible ? "auto" : "none" }}
        >
          前往首页
        </button>
      </div>
    </UpvpLayout>
  );
}
