import { useEffect } from "react";
import { RootLayout } from "./layouts/RootLayout";
import { useRouteStore } from "./stores/routeStore";
import { useTheme } from "./hooks/useTheme";
import { useConfigStore } from "./stores/configStore";
import { syncThemeFromConfig } from "./stores/themeStore";
import { syncA11yFromConfig } from "./stores/a11yStore";
import { syncBackgroundFromConfig } from "./stores/backgroundStore";
import { useAuthStore } from "./stores/authStore";
import { Home } from "./pages/home";
import { Store } from "./pages/store";
import { Today } from "./pages/today";
import { PlayLink } from "./pages/play-link";
import { Setting } from "./pages/setting";
import { Gallery } from "./pages/gallery";
import { TaskQueue } from "./pages/task-queue";
import { Debug } from "./pages/debug";
import { SplashDebug } from "./pages/debug/splash-debug";
import { DisplayDebug } from "./pages/debug/display-debug";
import { VersionCardDebug } from "./pages/debug/version-card-debug";
import { TaskDebug } from "./pages/debug/task-debug";
import { Oobe } from "./pages/oobe";
import { OobeAboutInfo } from "./pages/oobe/about-info";

const pageMap = {
  home: Home,
  store: Store,
  today: Today,
  "play-link": PlayLink,
  setting: Setting,
  gallery: Gallery,
  "task-queue": TaskQueue,
  oobe: Oobe,
  "oobe/about-info": OobeAboutInfo,
  debug: Debug,
  "debug-splash": SplashDebug,
  "debug-display": DisplayDebug,
  "debug-version-card": VersionCardDebug,
  "debug-task": TaskDebug,
} as const;

function App() {
  useTheme();
  const current = useRouteStore((s) => s.current);
  const Page = pageMap[current];

  useEffect(() => {
    useConfigStore.getState().init().then(() => {
      syncThemeFromConfig();
      syncA11yFromConfig();
      syncBackgroundFromConfig();
      useAuthStore.getState().initFromRegistry();
    });
  }, []);

  return (
    <RootLayout>
      <Page key={current} />
    </RootLayout>
  );
}

export default App;
