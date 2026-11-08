/** Network awareness for speculative work (v1.1.6, D-83). */
type Conn = { saveData?: boolean; effectiveType?: string; type?: string };
export type PreloadMode = "smart" | "wifi" | "off";
let qualityDataSaver = false;
let mode: PreloadMode = "smart";

/** Mirrors Settings › Data & storage › Preload titles. */
export function setPreloadMode(m: PreloadMode) { mode = m === "wifi" || m === "off" ? m : "smart"; }

/** Mirrors Settings › Playback › Stream quality: "Data Saver" (480) turns speculative fetching off. */
export function setPrefetchDataSaver(on: boolean) { qualityDataSaver = on; }

/** False when preloading is off, on Data Saver (browser or Panda quality), 2G/slow-2G, or mobile data in Wi-Fi only mode. */
export function canPrefetch(): boolean {
  if (qualityDataSaver || mode === "off") return false;
  if (typeof navigator === "undefined") return true;
  const c = (navigator as Navigator & { connection?: Conn }).connection;
  if (!c) return true;
  if (c.saveData) return false;
  // "Wi-Fi only": mobile data never preloads; WebViews that do not report a type are treated as Wi-Fi
  if (mode === "wifi" && c.type && c.type !== "wifi" && c.type !== "ethernet") return false;
  return c.effectiveType !== "2g" && c.effectiveType !== "slow-2g";
}

export function resetNetwork() { qualityDataSaver = false; mode = "smart"; }
