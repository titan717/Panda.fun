import type { PandaItem } from "../types";
import { canonicalGenres } from "../reco/genres";
import { ndcgAtK, precisionAtK, intraListDiversity, novelty } from "../reco/evaluate";

/**
 * Offline evaluation for Panda Intelligence (src/test/v150-eval.test.ts, docs/RECOMMENDATIONS.md §Evaluation).
 *
 * IMPORTANT: these are synthetic users over a captured catalogue snapshot. The numbers compare ranking methods on
 * identical data; they are not, and must not be reported as, real-world recommendation accuracy.
 */
export { ndcgAtK, precisionAtK, intraListDiversity, novelty };

export function recallAtK(list: readonly PandaItem[], relevant: Set<string>, k = 10) {
  return relevant.size ? list.slice(0, k).filter((i) => relevant.has(i.id)).length / relevant.size : 0;
}

export function hitAtK(list: readonly PandaItem[], relevant: Set<string>, k = 10) {
  return list.slice(0, k).some((i) => relevant.has(i.id)) ? 1 : 0;
}

/** Share of the catalogue that appears in anyone's top k. */
export function catalogueCoverage(lists: readonly (readonly PandaItem[])[], catalogue: number, k = 10) {
  return catalogue ? new Set(lists.flatMap((l) => l.slice(0, k).map((i) => i.id))).size / catalogue : 0;
}

export interface MethodResult { precision: number; recall: number; ndcg: number; hit: number; diversity: number; novelty: number; coverage: number; genres: number }

export function summarise(lists: PandaItem[][], relevant: Set<string>[], popular: Set<string>, catalogue: number, k = 10): MethodResult {
  const n = lists.length || 1;
  const mean = (f: (l: PandaItem[], r: Set<string>) => number) => lists.reduce((a, l, i) => a + f(l, relevant[i]!), 0) / n;
  return {
    precision: mean((l, r) => precisionAtK(l, r, k)),
    recall: mean((l, r) => recallAtK(l, r, k)),
    ndcg: mean((l, r) => ndcgAtK(l, r, k)),
    hit: mean((l, r) => hitAtK(l, r, k)),
    diversity: mean((l) => intraListDiversity(l, k)),
    novelty: mean((l) => novelty(l, popular, k)),
    coverage: catalogueCoverage(lists, catalogue, k),
    genres: mean((l) => new Set(l.slice(0, k).flatMap((i) => canonicalGenres(i.genres))).size)
  };
}
