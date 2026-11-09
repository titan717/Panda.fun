import { githubRelease, type GhRelease } from "./updates";

/** Release notes and What's New text (v1.2.1: split from updates.ts so the notes index stays out of the entry chunk, D-123). */
/** Pull the "## What's new in X" section out of a release body (falls back to the whole body without the changelog link). */
export function whatsNewSection(body: string, version: string): string {
  const text = body.replace(/\r/g, "");
  const head = new RegExp(`^##\\s+What's new in ${version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "im");
  const m = head.exec(text);
  const from = m ? m.index + m[0].length : 0;
  const rest = text.slice(from);
  const end = rest.search(m ? /^##\s|^\*\*Full Changelog\*\*/m : /^\*\*Full Changelog\*\*/m);
  return (end >= 0 ? rest.slice(0, end) : rest).trim();
}

/** Release notes for one version (GitHub Release `v{version}`), cached forever once fetched. */
const bundledNotes = import.meta.glob<string>("/docs/release-notes/v*.md", { query: "?raw", import: "default" });

export async function fetchReleaseNotes(version: string, signal?: AbortSignal): Promise<string> {
  const key = `panda:notes:${version}`;
  try { const c = localStorage.getItem(key); if (c) return c; } catch { /* storage disabled */ }
  // v1.1.8: notes shipped with the build need no network and are never rate-limited (each file is its own tiny lazy chunk).
  const local = bundledNotes[`/docs/release-notes/v${version}.md`];
  if (local) {
    try { const md = await local(); const notes = whatsNewSection(md, version); if (notes) return notes; } catch { /* fall through to GitHub */ }
  }
  let r: GhRelease | null;
  try { r = await githubRelease(`v${version}`, signal); }
  catch (e) { if (signal?.aborted) throw e; throw new Error("Release notes are busy right now. Try again in a few minutes."); }
  if (!r) throw new Error("No release notes for this version.");
  const notes = whatsNewSection(r.body ?? "", version);
  try { localStorage.setItem(key, notes); } catch { /* storage full */ }
  return notes;
}
