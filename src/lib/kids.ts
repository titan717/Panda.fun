/* Kids filters (split from rows.ts in v1.1.9 so the Kids gate does not pull the Home row builder into the entry). */
import type { PandaItem, TitleDetails } from "./types";

const KIDS_GENRES = new Set(["Animation", "Family", "Kids"]);
export const isKidsSafe = (i: PandaItem) => i.genres.some((g) => KIDS_GENRES.has(g));
/** Ratings that are never suitable for a Kids profile, across US film/TV, UK, India and common numeric systems. */
const MATURE = /^(R|NC-17|X|TV-MA|TV-14|PG-13|15|16|18|18\+|A|UA 16\+|R18|MA15\+|MA|M18|NC16)$/i;
/** Full check once the details (with certification) are known. */
export const isKidsSafeTitle = (d: Pick<TitleDetails, "genres" | "certification">) =>
  d.genres.some((g) => KIDS_GENRES.has(g)) && !(d.certification && MATURE.test(d.certification.trim()));

