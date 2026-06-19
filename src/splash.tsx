import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import Splash from "./components/splash/Splash";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Splash />
  </StrictMode>
);
