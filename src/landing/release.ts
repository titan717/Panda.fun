// Release metadata for the /welcome download section (v1.2.9). Only values present in the GitHub release are shown.
export const APK_NAME = "Panda.fun-Android-TV.apk";

export interface ReleaseAsset { name: string; size: number; browser_download_url: string }
export interface Release { tag_name: string; published_at?: string; html_url?: string; assets?: ReleaseAsset[] }

export function formatSize(bytes: number): string {
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export function releaseInfo(r: Release): { version: string; size: string | null; date: string | null; url: string | null; sha: string | null } {
  const apk = r.assets?.find((a) => a.name === APK_NAME);
  const sha = r.assets?.find((a) => a.name === `${APK_NAME}.sha256`);
  const d = r.published_at ? new Date(r.published_at) : null;
  return {
    version: r.tag_name.replace(/^v/, ""),
    size: apk && apk.size > 0 ? formatSize(apk.size) : null,
    date: d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : null,
    url: apk?.browser_download_url ?? null,
    sha: sha?.browser_download_url ?? null
  };
}

