import React from "react";
import ReactDOM from "react-dom/client";
import { CrashPage } from "./pages/crash";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <CrashPage />
  </React.StrictMode>,
);
