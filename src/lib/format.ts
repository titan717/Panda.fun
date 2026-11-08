import type { PandaItem, TitleDetails } from "./types";

export function runtime(min: number | null | undefined) {
  if (!min || min <= 0) return null;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}

export function timeLeft(position: number, duration: number) {
  const left = Math.max(0, Math.round((duration - position) / 60));
  if (!duration) return null;
  return left >= 60 ? `${Math.floor(left / 60)}h ${left % 60}m left` : `${Math.max(1, left)}m left`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** True when an episode's air date is still in the future (local calendar day), so it can't be played yet. */
export function airsLater(iso: string | null | undefined, now = new Date()) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return false;
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return iso.slice(0, 10) > today;
}

export function shortDate(iso: string | null | undefined, withYear = true) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  return withYear ? `${d} ${MONTHS[m - 1]} ${y}` : `${d} ${MONTHS[m - 1]}`;
}

export function languagesLabel(n: number) {
  return n > 1 ? `${n} Languages` : null;
}

const LANG_NAMES: Record<string, string> = { en: "English", hi: "Hindi", ml: "Malayalam", ta: "Tamil", te: "Telugu", kn: "Kannada", bn: "Bengali", mr: "Marathi", ko: "Korean", ja: "Japanese", es: "Spanish", fr: "French", de: "German", it: "Italian", zh: "Chinese", pt: "Portuguese", ru: "Russian", tr: "Turkish", th: "Thai", ar: "Arabic" };
export function languageName(code: string | null | undefined) {
  if (!code) return null;
  return LANG_NAMES[code] ?? code.toUpperCase();
}

/** "2026 • 5 Languages • Comedy • Drama" (mobile hero, BLUEPRINT_SPEC 12.2). */
export function itemMeta(i: PandaItem, max = 2) {
  return [i.year, languageName(i.language), ...i.genres.slice(0, max)].filter(Boolean).join(" • ");
}

export function isNew(i: PandaItem, days = 60) {
  if (!i.releaseDate) return false;
  const t = Date.parse(i.releaseDate);
  return Number.isFinite(t) && Date.now() - t < days * 86_400_000 && Date.now() >= t;
}

export function isUpcoming(i: PandaItem) {
  if (!i.releaseDate) return false;
  return Date.parse(i.releaseDate) > Date.now();
}

/** Landscape card line: "Coming 14 Nov • Telugu" for titles not yet released, otherwise year, language and genre. */
export function landMeta(i: PandaItem) {
  if (isUpcoming(i)) return [`Coming ${shortDate(i.releaseDate, false)}`, languageName(i.language), i.genres[0]].filter(Boolean).join(" • ");
  return itemMeta(i, 1);
}

/** Data-driven poster badge (BLUEPRINT_SPEC 12.5). */
export function itemBadge(i: PandaItem): string | null {
  if (isUpcoming(i)) return `IN CINEMAS ${shortDate(i.releaseDate, false)?.toUpperCase()}`;
  if (isNew(i, 30)) return i.type === "tv" ? "NEW EPISODES" : "NEWLY ADDED";
  return null;
}

export function detailsMeta(d: TitleDetails) {
  const parts: string[] = [];
  if (d.year) parts.push(String(d.year));
  if (d.type === "tv" && d.numberOfSeasons) parts.push(`${d.numberOfSeasons} Season${d.numberOfSeasons > 1 ? "s" : ""}`);
  if (d.type === "movie") { const r = runtime(d.runtime); if (r) parts.push(r); }
  const l = languagesLabel(d.languages.length);
  if (l) parts.push(l);
  return parts;
}

export function pluralEps(n: number) { return `${n} Ep${n === 1 ? "" : "s"}`; }

export function titlePath(i: { type: string; tmdbId: number }) { return `/title/${i.type}/${i.tmdbId}`; }
export function watchPath(type: string, id: number, s?: number, e?: number) {
  return type === "tv" ? `/watch/tv/${id}?s=${s ?? 1}&e=${e ?? 1}` : `/watch/movie/${id}`;
}

/** Link to the browse grid. `kind` is a media type or "trending"; extra params are discover filters + display title. */
export function browseHref(kind: "movie" | "tv" | "trending", params: Record<string, string | undefined> = {}) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) p.set(k, v);
  const s = p.toString();
  return `/browse/${kind}${s ? `?${s}` : ""}`;
}

/** Human title for a backend rail link such as /browse/movie?genre=53 when no explicit title is given. */
export function browseTitle(kind: string, p: URLSearchParams) {
  if (p.get("title")) return p.get("title")!;
  if (kind === "trending") return "Trending Now";
  const what = kind === "tv" ? "Shows" : "Movies";
  if (p.get("lang")) return `${languageName(p.get("lang"))} ${what}`;
  if (p.get("country") === "IN") return `Indian ${what}`;
  if (p.get("sort") === "new") return `New ${what}`;
  if (p.get("sort") === "airing") return "Latest TV Episodes";
  if (p.get("sort") === "vote_average.desc") return `Top Rated ${what}`;
  return `Popular ${what}`;
}

/** Cast then key crew for the Cast section (v1.1.2); someone who both acts and directs appears once, as cast. */
export function castAndCrew(d: Pick<TitleDetails, "cast" | "crew">) {
  const seen = new Set<number>();
  const out: { id: number; name: string; role: string | null; profile: string | null }[] = [];
  for (const c of d.cast) if (!seen.has(c.id)) { seen.add(c.id); out.push({ id: c.id, name: c.name, role: c.character, profile: c.profile }); }
  for (const c of d.crew ?? []) if (!seen.has(c.id)) { seen.add(c.id); out.push({ id: c.id, name: c.name, role: c.job, profile: c.profile }); }
  return out;
}

/** "34K ratings", "1.2M ratings", "870 ratings"; null when TMDB has too few votes to mean anything. */
export function voteLabel(n: number | null | undefined) {
  if (!n || n < 10) return null;
  const v = n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, "")}M` : n >= 1e3 ? `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, "")}K` : String(n);
  return `${v} ratings`;
}
