import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/inter";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/tv.css";
import "./styles/mobile.css";
import { App } from "./App";
import { flushStore } from "./lib/store";
import { hydrateCache } from "./lib/cache";
import { installAudioUnlock, stopAllTrailers } from "./lib/audio";

window.addEventListener("pagehide", flushStore);
installAudioUnlock();
document.addEventListener("visibilitychange", () => { if (document.hidden) stopAllTrailers(); });

// Paint from the persisted API cache in the first frame (warm start), then revalidate.
void hydrateCache().then(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
});
