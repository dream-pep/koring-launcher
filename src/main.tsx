import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { isDev } from "./lib/mode";
import "./index.css";

if (!isDev) {
  document.addEventListener("contextmenu", (e) => e.preventDefault());
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
