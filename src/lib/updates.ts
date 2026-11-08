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

const RELEASE_CACHE_KEY = "panda:release-cache";
const RELEASE_CACHE_MS = 15 * 60_000;

function readReleaseCache(): { at: number; release: ReleaseInfo } | null {
  try {
    const raw = localStorage.getItem(RELEASE_CACHE_KEY);
    return raw ? (JSON.parse(raw) as { at: number; release: ReleaseInfo }) : null;
  } catch { return null; }
}

/**
 * Latest stable GitHub Release. Results are cached for 15 minutes so background checks
 * stay well inside GitHub's unauthenticated rate limit; `force` skips the cache (manual check)
 * but still falls back to the cached copy when GitHub rate-limits the request.
 */
export async function fetchLatestRelease(signal?: AbortSignal, force = false): Promise<ReleaseInfo> {
  const cached = readReleaseCache();
  if (!force && cached && Date.now() - cached.at < RELEASE_CACHE_MS) return cached.release;
  const res = await fetch(`https://api.github.com/repos/${RELEASES_REPO}/releases/latest`, { signal, headers: { Accept: "application/vnd.github+json" } });
  if (res.status === 404) throw new Error("No published release yet.");
  if ((res.status === 403 || res.status === 429) && cached) return cached.release;
  if (res.status === 403 || res.status === 429) throw new Error("GitHub is limiting update checks right now. Try again in a few minutes.");
  if (!res.ok) throw new Error(`GitHub returned ${res.status}.`);
  const r = (await res.json()) as { tag_name: string; name: string | null; body: string | null; published_at: string; html_url: string; assets: { name: string; browser_download_url: string; size: number }[] };
  const apk = r.assets.find((a) => a.name.toLowerCase().endsWith(".apk")) ?? null;
  const release: ReleaseInfo = {
    tag: r.tag_name,
    version: r.tag_name.replace(/^v/i, ""),
    name: r.name ?? r.tag_name,
    notes: (r.body ?? "").trim(),
    publishedAt: r.published_at,
    htmlUrl: r.html_url,
    apkUrl: apk?.browser_download_url ?? null,
    apkSize: apk?.size ?? null
  };
  try { localStorage.setItem(RELEASE_CACHE_KEY, JSON.stringify({ at: Date.now(), release })); } catch { /* storage full or disabled */ }
  return release;
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

/** Pull the "## What's new in X" section out of a release body (falls back to the whole body without the changelog link). */
export function whatsNewSection(body: string, version: string): string {
  const text = body.replace(/\r/g, "");
  const head = new RegExp(`^##\\s+What's new in ${version.replace(/\./g, "\\.")}\\s*$`, "im");
  const m = head.exec(text);
  const from = m ? m.index + m[0].length : 0;
  const rest = text.slice(from);
  const end = rest.search(m ? /^##\s|^\*\*Full Changelog\*\*/m : /^\*\*Full Changelog\*\*/m);
  return (end >= 0 ? rest.slice(0, end) : rest).trim();
}

/** Release notes for one version (GitHub Release `v{version}`), cached forever once fetched. */
export async function fetchReleaseNotes(version: string, signal?: AbortSignal): Promise<string> {
  const key = `panda:notes:${version}`;
  try { const c = localStorage.getItem(key); if (c) return c; } catch { /* storage disabled */ }
  const res = await fetch(`https://api.github.com/repos/${RELEASES_REPO}/releases/tags/v${version}`, { signal, headers: { Accept: "application/vnd.github+json" } });
  if (!res.ok) throw new Error(res.status === 404 ? "No release notes for this version." : `GitHub returned ${res.status}.`);
  const r = (await res.json()) as { body: string | null };
  const notes = whatsNewSection(r.body ?? "", version);
  try { localStorage.setItem(key, notes); } catch { /* storage full */ }
  return notes;
}

const SEEN_KEY = "panda:seen-version";

/**
 * Returns the installed version once after it changes (an update was installed), otherwise null.
 * A fresh install records the version silently so first-time users are not greeted with release notes.
 */
export function takeUpdateNotice(current = installedVersion()): string | null {
  try {
    const seen = localStorage.getItem(SEEN_KEY);
    if (seen === current) return null;
    localStorage.setItem(SEEN_KEY, current);
    return seen && compareVersions(current, seen) > 0 ? current : null;
  } catch { return null; }
}
