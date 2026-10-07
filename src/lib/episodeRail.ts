export type EpisodeRailOrder = 'asc' | 'desc';

type NumberedEpisode = {
  id?: string | number;
  number?: number | null;
};

export function sortEpisodesForDisplay<T extends NumberedEpisode>(
  episodes: T[],
  order: EpisodeRailOrder = 'asc'
): T[] {
  const seenNumbers = new Set<number>();

  return [...episodes]
    .filter((episode) => {
      const number = Number(episode.number);
      if (!Number.isInteger(number) || number < 1 || seenNumbers.has(number)) return false;
      seenNumbers.add(number);
      return true;
    })
    .sort((a, b) => {
      const delta = Number(a.number) - Number(b.number);
      return order === 'asc' ? delta : -delta;
    });
}

export function calculateEpisodeRailStep(cardWidth: number, gap: number): number {
  return (Math.max(0, Number(cardWidth) || 0) + Math.max(0, Number(gap) || 0)) * 3.5;
}
