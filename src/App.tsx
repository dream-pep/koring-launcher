import { RootLayout } from "./layouts/RootLayout";
import { useRouteStore } from "./stores/routeStore";
import { useTheme } from "./hooks/useTheme";
import { Home } from "./pages/home";
import { Store } from "./pages/store";
import { Today } from "./pages/today";
import { PlayLink } from "./pages/play-link";
import { Setting } from "./pages/setting";
import { TaskQueue } from "./pages/task-queue";
import { Debug } from "./pages/debug";
import { SplashDebug } from "./pages/debug/splash-debug";
import { DisplayDebug } from "./pages/debug/display-debug";
import { VersionCardDebug } from "./pages/debug/version-card-debug";
import { TaskDebug } from "./pages/debug/task-debug";

const pageMap = {
  home: Home,
  store: Store,
  today: Today,
  "play-link": PlayLink,
  setting: Setting,
  "task-queue": TaskQueue,
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

  return (
    <RootLayout>
      <Page key={current} />
    </RootLayout>
  );
}

export default App;
