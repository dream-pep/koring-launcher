import { useState } from "react";
import { RootLayout } from "./layouts/RootLayout";
import { Home } from "./pages/Home";
import { Debug } from "./pages/Debug";

type Page = "home" | "debug";

function App() {
  const [page, setPage] = useState<Page>("home");

  return (
    <RootLayout>
      {page === "home" && <Home onNavigate={setPage} />}
      {page === "debug" && <Debug onNavigate={setPage} />}
    </RootLayout>
  );
}

export default App;
