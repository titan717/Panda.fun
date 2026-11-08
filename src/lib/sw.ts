/** Register the web service worker (D-53). Skipped in development, inside the Android app (files ship in the APK) and on http. */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  if (window.KinomaNative || location.protocol !== "https:") return;
  const go = () => { navigator.serviceWorker.register("/sw.js").catch(() => { /* private mode or blocked: the app works without it */ }); };
  if (document.readyState === "complete") go(); else window.addEventListener("load", go, { once: true });
}
