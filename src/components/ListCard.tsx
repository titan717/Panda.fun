import { Link } from "wouter";
import { Icon } from "./Icon";
import { Img } from "./ui";
import type { UserList } from "../lib/store";

export const listHref = (id: string) => `/my-list?list=${encodeURIComponent(id)}`;
export const countLabel = (n: number) => `${n} ${n === 1 ? "title" : "titles"}`;

/** A custom list: a three-poster collage, its name and how many titles it holds (Watchlist 2.0). */
export function ListCard({ list, id, tv }: { list: UserList; id?: string; tv: boolean }) {
  const posters = list.items.filter((i) => i.poster).slice(0, 3);
  return (
    <Link href={listHref(list.id)} id={id} className={tv ? "tv-card list-card" : "list-card m-list-card"} data-hover-focus aria-label={`${list.name}, ${countLabel(list.items.length)}`}>
      <span className="list-collage">
        {posters.length
          ? posters.map((p) => <span key={p.id} className="list-collage-cell"><Img src={p.poster} alt="" title={p.title} /></span>)
          : <span className="list-collage-empty"><Icon name="list" /></span>}
      </span>
      <span className="list-name">{list.name}</span>
      <span className="list-count">{countLabel(list.items.length)}</span>
    </Link>
  );
}

export function NewListCard({ id, tv, onClick }: { id?: string; tv: boolean; onClick: () => void }) {
  return (
    <button id={id} className={tv ? "tv-card list-card is-new" : "list-card m-list-card is-new"} onClick={onClick} data-hover-focus aria-label="Create a new list">
      <span className="list-collage"><span className="list-collage-empty"><Icon name="plus" /></span></span>
      <span className="list-name">New list</span>
      <span className="list-count">Group titles your way</span>
    </button>
  );
}
