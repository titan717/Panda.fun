import { isAndroidApp, nativeIsTV } from "./native";

export type LayoutMode = "tv" | "mobile";

const TV_UA = /(SmartTV|SMART-TV|Android TV|AndroidTV|Leanback|GoogleTV|CrKey|AFT[A-Z0-9]|BRAVIA|Web0S|webOS|NetCast|Tizen|HbbTV|Roku|Viera|AQUOSBrowser|PhilipsTV|Hisense|VIDAA|TV Safari)/i;

/**
 * Layout is chosen by screen size AND input type (BLUEPRINT_SPEC 4, 11):
 *  - TV layout: TV user agents/Android TV, or a large screen driven by a fine pointer/keyboard (desktop).
 *  - Mobile layout: touch-first devices (phones, tablets) and any viewport narrower than 900px.
 */
export function detectLayout(override: "auto" | LayoutMode = "auto"): LayoutMode {
  if (override !== "auto") return override;
  if (typeof window === "undefined") return "mobile";
  const forced = new URLSearchParams(window.location.search).get("layout");
  if (forced === "tv" || forced === "mobile") return forced;
  // Inside the Android app the native bridge is authoritative (phones must never get the TV layout).
  if (isAndroidApp) return nativeIsTV() ? "tv" : "mobile";
  if (TV_UA.test(navigator.userAgent)) return "tv";
  const coarse = window.matchMedia("(pointer: coarse)").matches && !window.matchMedia("(any-pointer: fine)").matches;
  if (coarse) return "mobile";
  return window.innerWidth >= 900 && window.innerHeight >= 480 ? "tv" : "mobile";
}

export function isTvDevice() {
  if (typeof window === "undefined") return false;
  if (isAndroidApp) return nativeIsTV();
  return TV_UA.test(navigator.userAgent);
}
