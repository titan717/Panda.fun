import type { PandaItem } from "../types";
import { canonicalGenres } from "./genres";

/**
 * Offline evaluation helpers (src/test/v140-reco.test.ts). The numbers they produce come from a captured catalogue
 * snapshot and synthetic profiles — useful to compare the engine with a baseline on the same data, not a claim
 * about real-world engagement.
 */
export function precisionAtK(list: readonly PandaItem[], relevant: Set<string>, k = 10) {
  const top = list.slice(0, k);
  return top.length ? top.filter((i) => relevant.has(i.id)).length / top.length : 0;
}

export function ndcgAtK(list: readonly PandaItem[], relevant: Set<string>, k = 10) {
  const dcg = list.slice(0, k).reduce((a, i, n) => a + (relevant.has(i.id) ? 1 / Math.log2(n + 2) : 0), 0);
  const ideal = Array.from({ length: Math.min(k, relevant.size) }, (_, n) => 1 / Math.log2(n + 2)).reduce((a, b) => a + b, 0);
  return ideal ? dcg / ideal : 0;
}

/** Mean pairwise genre dissimilarity (1 − Jaccard) of a list: 0 = all alike, 1 = nothing shared. */
export function intraListDiversity(list: readonly PandaItem[], k = 10) {
  const top = list.slice(0, k).map((i) => new Set(canonicalGenres(i.genres)));
  let sum = 0, n = 0;
  for (let a = 0; a < top.length; a++) for (let b = a + 1; b < top.length; b++) {
    const A = top[a]!, B = top[b]!;
    const inter = [...A].filter((g) => B.has(g)).length;
    const union = new Set([...A, ...B]).size || 1;
    sum += 1 - inter / union; n++;
  }
  return n ? sum / n : 0;
}

/** Distinct canonical genres covered by the top k. */
export function genreCoverage(list: readonly PandaItem[], k = 10) {
  return new Set(list.slice(0, k).flatMap((i) => canonicalGenres(i.genres))).size;
}

/** Share of the top k that is not on the popular list (novelty). */
export function novelty(list: readonly PandaItem[], popular: Set<string>, k = 10) {
  const top = list.slice(0, k);
  return top.length ? top.filter((i) => !popular.has(i.id)).length / top.length : 0;
}
