import { useEffect } from "react";
import { RootLayout } from "./layouts/RootLayout";
import { useRouteStore } from "./stores/routeStore";
import { useTheme } from "./hooks/useTheme";
import { useConfigStore } from "./stores/configStore";
import { syncThemeFromConfig } from "./stores/themeStore";
import { syncA11yFromConfig } from "./stores/a11yStore";
import { syncBackgroundFromConfig } from "./stores/backgroundStore";
import { useAuthStore } from "./stores/authStore";
import { useKoringAuthStore } from "./stores/koringAuthStore";
import type { AppConfig } from "./api/config";
import { Home } from "./pages/home";
import { Today } from "./pages/today";
import { PlayLink } from "./pages/play-link";
import { Setting } from "./pages/setting";
import { SettingLogin } from "./pages/setting/login";
import { TaskQueue } from "./pages/task-queue";
import { GalleryPlaceholder, StorePlaceholder } from "./pages/placeholder";
import { UpdatePage } from "./pages/update";
import { Debug } from "./pages/debug";
import { SplashDebug } from "./pages/debug/splash-debug";
import { DisplayDebug } from "./pages/debug/display-debug";
import { VersionCardDebug } from "./pages/debug/version-card-debug";
import { UpdateDebug } from "./pages/debug/update-debug";
import { TaskDebug } from "./pages/debug/task-debug";
import { CrashDebug } from "./pages/debug/crash-debug";
import { ResourceDebug } from "./pages/debug/resource-debug";
import { RoutesDebug } from "./pages/debug/routes-debug";
import { Oobe } from "./pages/oobe";
import { OobeLanguage } from "./pages/oobe/step-language";
import { OobeAgreement } from "./pages/oobe/step-agreement";
import { OobeLogin } from "./pages/oobe/step-login";
import { OobeWelcome } from "./pages/oobe/step-welcome";
import { OobeVersion } from "./pages/oobe/step-version";
import { OobeBetaTest } from "./pages/oobe/step-beta-test";
import { OobeFinish } from "./pages/oobe/step-finish";
import { OobeLegal } from "./pages/oobe/step-legal";
import { OobeAboutInfo } from "./pages/oobe/about-info";
import { UpvpComplete } from "./pages/upvp/step-complete";
import { UpvpVersion } from "./pages/upvp/step-version";
import { UpvpCheck } from "./pages/upvp/step-check";
import { UpvpBetaTest } from "./pages/upvp/step-beta-test";
import { UpvpFinish } from "./pages/upvp/step-finish";
import { VERSION } from "./lib/version";

const pageMap = {
  home: Home,
  store: StorePlaceholder,
  today: Today,
  "play-link": PlayLink,
  setting: Setting,
  "setting/login": SettingLogin,
  gallery: GalleryPlaceholder,
  "task-queue": TaskQueue,
  update: UpdatePage,
  oobe: Oobe,
  "oobe/language": OobeLanguage,
  "oobe/agreement": OobeAgreement,
  "oobe/login": OobeLogin,
  "oobe/welcome": OobeWelcome,
  "oobe/version": OobeVersion,
  "oobe/beta-test": OobeBetaTest,
  "oobe/finish": OobeFinish,
  "oobe/about-info": OobeAboutInfo,
  "oobe/legal": OobeLegal,
  upvp: UpvpComplete,
  "upvp/complete": UpvpComplete,
  "upvp/version": UpvpVersion,
  "upvp/check": UpvpCheck,
  "upvp/beta-test": UpvpBetaTest,
  "upvp/finish": UpvpFinish,
  debug: Debug,
  "debug-splash": SplashDebug,
  "debug-display": DisplayDebug,
  "debug-version-card": VersionCardDebug,
  "debug-update": UpdateDebug,
  "debug-task": TaskDebug,
  "debug-crash": CrashDebug,
  "debug-resource": ResourceDebug,
  "debug-routes": RoutesDebug,
} as const;

function App() {
  useTheme();
  const current = useRouteStore((s) => s.current);
  const Page = pageMap[current];

  useEffect(() => {
    let done = false;
    let cancelled = false;

    // 配置引导（幂等，最多执行一次）：
    // 主进程的 config:preload 推送 与 config:get 兜底拉取，谁先完成谁引导，
    // 避免重复同步派生 store / 重复导航 / 重复补写版本号。
    const finishBoot = (cfg: AppConfig, isFirstLaunch: boolean) => {
      if (done || cancelled) return;
      done = true;
      useConfigStore.getState().applyPreloaded(cfg, isFirstLaunch);
      // 语言偏好 → <html lang>
      document.documentElement.lang = cfg.app?.language ?? "zh-CN";
      syncThemeFromConfig();
      syncA11yFromConfig();
      syncBackgroundFromConfig();
      useAuthStore.getState().initFromRegistry();
      useKoringAuthStore.getState().initFromDisk();

      // 首次启动 / 未完成 OOBE → OOBE
      if (isFirstLaunch || cfg.oobe) {
        useRouteStore.getState().navigate("oobe");
        return;
      }

      // 配置里没有版本记录 → 补写当前版本（新装/旧配置迁移），直接进主页
      if (!cfg.appVersion) {
        useConfigStore.getState().setAppVersion(VERSION);
        return;
      }

      // 程序版本 ≠ 配置版本 → 进入更新引导（upvp）：
      // 升级后 appVersion 仍是旧版本号（主进程不自动刷新），由 upvp 流程完成时写入新版本
      if (cfg.appVersion !== VERSION) {
        useRouteStore.getState().navigate("upvp/complete");
      }
    };

    const api = window.electronAPI;
    let unsub: (() => void) | undefined;
    if (api) {
      // 主进程在每次 did-finish-load（含 Ctrl+R / F5 刷新）时推送的最新权威配置
      unsub = api.onConfigPreload((data) => {
        finishBoot(data.config as AppConfig, data.isFirstLaunch);
      });

      // 兜底：config:preload 是主进程在页面加载完成后的一次性推送，
      // 若它早于本订阅到达（页面刷新/快速重载时的竞态）就会被丢弃，store 将永远停在默认值。
      // 此时主动走 config:get 拉取主进程权威配置，保证刷新后配置一定能被读到。
      if (!useConfigStore.getState().loaded) {
        useConfigStore
          .getState()
          .init()
          .then(() => {
            if (cancelled) return;
            const { config, isFirstLaunch } = useConfigStore.getState();
            finishBoot(config, isFirstLaunch);
          })
          .catch((e) => {
            console.error("[config] fallback init failed:", e);
          });
      }
    }

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  // 主进程权威配置广播 → 覆盖本地镜像并同步派生 store
  useEffect(() => {
    const unsub = window.electronAPI?.onConfigChanged((config) => {
      useConfigStore.getState().applyChanged(config as AppConfig);
      syncThemeFromConfig();
      syncA11yFromConfig();
      syncBackgroundFromConfig();
    });

    return () => { unsub?.(); };
  }, []);

  return (
    <RootLayout>
      <Page key={current} />
    </RootLayout>
  );
}

export default App;
