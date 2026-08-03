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
import { Store } from "./pages/store";
import { Today } from "./pages/today";
import { PlayLink } from "./pages/play-link";
import { Setting } from "./pages/setting";
import { SettingLogin } from "./pages/setting/login";
import { Gallery } from "./pages/gallery";
import { TaskQueue } from "./pages/task-queue";
import { Debug } from "./pages/debug";
import { SplashDebug } from "./pages/debug/splash-debug";
import { DisplayDebug } from "./pages/debug/display-debug";
import { VersionCardDebug } from "./pages/debug/version-card-debug";
import { TaskDebug } from "./pages/debug/task-debug";
import { CrashDebug } from "./pages/debug/crash-debug";
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

const pageMap = {
  home: Home,
  store: Store,
  today: Today,
  "play-link": PlayLink,
  setting: Setting,
  "setting/login": SettingLogin,
  gallery: Gallery,
  "task-queue": TaskQueue,
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
  debug: Debug,
  "debug-splash": SplashDebug,
  "debug-display": DisplayDebug,
  "debug-version-card": VersionCardDebug,
  "debug-task": TaskDebug,
  "debug-crash": CrashDebug,
} as const;

function App() {
  useTheme();
  const current = useRouteStore((s) => s.current);
  const Page = pageMap[current];

  useEffect(() => {
    // Listen for preloaded config from main process
    const unsub = window.electronAPI?.onConfigPreload((data) => {
      const { config, isFirstLaunch } = data;
      useConfigStore.getState().applyPreloaded(config as AppConfig, isFirstLaunch);
      syncThemeFromConfig();
      syncA11yFromConfig();
      syncBackgroundFromConfig();
      useAuthStore.getState().initFromRegistry();
      useKoringAuthStore.getState().initFromDisk();
      // Navigate to OOBE on first launch or if oobe not completed
      if (isFirstLaunch || config.oobe) {
        useRouteStore.getState().navigate("oobe");
      }
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
