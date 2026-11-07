import { isAndroidApp, native, nativeVersion } from "./native";

export const RELEASES_REPO = (import.meta.env.VITE_RELEASES_REPO as string | undefined) ?? "titan717/Panda.fun";
export const WEB_VERSION: string = __APP_VERSION__;

export interface ReleaseInfo {
  tag: string;
  version: string;
  name: string;
  notes: string;
  publishedAt: string;
  htmlUrl: string;
  apkUrl: string | null;
  apkSize: number | null;
}

/** Semantic version compare that tolerates "v" prefixes and pre-release suffixes (1.0.0 > 1.0.0-beta.3 > 0.9.9). */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string) => {
    const [core = "0", pre] = v.trim().replace(/^v/i, "").split("-", 2);
    const nums = core.split(".").map((n) => parseInt(n, 10) || 0);
    while (nums.length < 3) nums.push(0);
    return { nums, pre: pre ?? null };
  };
  const x = parse(a);
  const y = parse(b);
  for (let i = 0; i < 3; i++) if (x.nums[i] !== y.nums[i]) return (x.nums[i] ?? 0) > (y.nums[i] ?? 0) ? 1 : -1;
  if (x.pre === y.pre) return 0;
  if (x.pre === null) return 1;
  if (y.pre === null) return -1;
  return x.pre.localeCompare(y.pre, undefined, { numeric: true });
}

export function installedVersion(): string {
  return nativeVersion() ?? WEB_VERSION;
}

export async function fetchLatestRelease(signal?: AbortSignal): Promise<ReleaseInfo> {
  const res = await fetch(`https://api.github.com/repos/${RELEASES_REPO}/releases/latest`, { signal, headers: { Accept: "application/vnd.github+json" } });
  if (res.status === 404) throw new Error("No published release yet.");
  if (!res.ok) throw new Error(`GitHub returned ${res.status}.`);
  const r = (await res.json()) as { tag_name: string; name: string | null; body: string | null; published_at: string; html_url: string; assets: { name: string; browser_download_url: string; size: number }[] };
  const apk = r.assets.find((a) => a.name.toLowerCase().endsWith(".apk")) ?? null;
  return {
    tag: r.tag_name,
    version: r.tag_name.replace(/^v/i, ""),
    name: r.name ?? r.tag_name,
    notes: (r.body ?? "").trim(),
    publishedAt: r.published_at,
    htmlUrl: r.html_url,
    apkUrl: apk?.browser_download_url ?? null,
    apkSize: apk?.size ?? null
  };
}

export type NativeUpdateStatus =
  | { status: "checking" }
  | { status: "up-to-date" }
  | { status: "available"; versionName?: string; releaseNotes?: string }
  | { status: "downloading"; progress?: number }
  | { status: "ready" }
  | { status: "installing" }
  | { status: "error"; message?: string };

export function onNativeUpdateStatus(cb: (s: NativeUpdateStatus) => void) {
  const handler = (e: Event) => cb((e as CustomEvent<NativeUpdateStatus>).detail);
  window.addEventListener("panda_native_update_status", handler);
  return () => window.removeEventListener("panda_native_update_status", handler);
}

export const nativeUpdates = {
  available: isAndroidApp,
  check: () => native?.checkForUpdatesManual(),
  download: () => native?.downloadUpdate()
};
