import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/inter";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/tv.css";
import "./styles/mobile.css";
import { App } from "./App";
import { flushStore } from "./lib/store";

window.addEventListener("pagehide", flushStore);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
