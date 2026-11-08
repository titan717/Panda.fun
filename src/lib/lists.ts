import type { PandaItem } from "./types";

export type ListFilter = "all" | "movie" | "tv";
export type ListSort = "recent" | "az" | "release";
export const LIST_SORTS: { id: ListSort; label: string }[] = [
  { id: "recent", label: "Recently added" },
  { id: "az", label: "A–Z" },
  { id: "release", label: "Release date" }
];

/** Watchlist view: the list is stored newest-first, so "recent" keeps that order. */
export function sortList(list: PandaItem[], filter: ListFilter, sort: ListSort) {
  const items = filter === "all" ? list.slice() : list.filter((i) => i.type === filter);
  if (sort === "az") items.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
  if (sort === "release") items.sort((a, b) => (b.releaseDate ?? String(b.year ?? "")).localeCompare(a.releaseDate ?? String(a.year ?? "")));
  return items;
}
