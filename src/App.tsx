import { RootLayout } from "./layouts/RootLayout";
import { useRouteStore } from "./stores/routeStore";
import { useTheme } from "./hooks/useTheme";
import { Home } from "./pages/home";
import { Store } from "./pages/store";
import { Today } from "./pages/today";
import { PlayLink } from "./pages/play-link";
import { Setting } from "./pages/setting";
import { Debug } from "./pages/setting/debug";

const pageMap = {
  home: Home,
  store: Store,
  today: Today,
  "play-link": PlayLink,
  setting: Setting,
  debug: Debug,
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
