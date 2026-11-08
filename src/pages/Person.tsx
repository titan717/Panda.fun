import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "wouter";
import { PageHeader } from "../components/PageHeader";
import { ErrorState, Img, Skeleton } from "../components/ui";
import { useIsTv } from "../lib/layout";
import { usePerson } from "../lib/hooks";
import { useProfile } from "../lib/store";
import { isKidsSafe } from "../lib/rows";
import { focusFirst } from "../lib/focus";
import { TvPoster } from "../tv/TvCards";
import { MPoster } from "../mobile/MCards";
import { NotFoundPage } from "./Lists";
import type { PersonDetails } from "../lib/types";

const DEPARTMENT: Record<string, string> = { Acting: "Actor", Directing: "Director", Writing: "Writer", Production: "Producer", Sound: "Composer", Camera: "Cinematographer", Editing: "Editor", Creator: "Creator" };

/** "Actor • Born 9 July 1956 in Concord, California, USA (age 70)" — only the facts TMDB has. */
export function personFacts(p: Pick<PersonDetails, "department" | "birthday" | "deathday" | "placeOfBirth">, now = new Date()) {
  const out: string[] = [];
  if (p.department) out.push(DEPARTMENT[p.department] ?? p.department);
  const fmt = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const valid = (d: string | null): d is string => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d);
  if (valid(p.birthday)) {
    const end = valid(p.deathday) ? new Date(`${p.deathday}T00:00:00Z`) : now;
    const b = new Date(`${p.birthday}T00:00:00Z`);
    let age = end.getUTCFullYear() - b.getUTCFullYear();
    if (end.getUTCMonth() < b.getUTCMonth() || (end.getUTCMonth() === b.getUTCMonth() && end.getUTCDate() < b.getUTCDate())) age--;
    const where = p.placeOfBirth ? ` in ${p.placeOfBirth}` : "";
    out.push(valid(p.deathday) ? `${fmt(p.birthday)} – ${fmt(p.deathday)} (aged ${age})` : `Born ${fmt(p.birthday)}${where} (age ${age})`);
  } else if (p.placeOfBirth) out.push(`Born in ${p.placeOfBirth}`);
  return out;
}

/** Cast and crew page (v1.1.2): photo, facts, biography and every title they are known for. */
export function PersonPage() {
  const { id } = useParams<{ id: string }>();
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) return <NotFoundPage />;
  return <Person key={n} id={n} />;
}

function Person({ id }: { id: number }) {
  const tv = useIsTv();
  const profile = useProfile();
  const { data: p, error, mutate } = usePerson(id);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const known = useMemo(() => (p?.knownFor ?? []).filter((k) => !profile?.kids || isKidsSafe(k)), [p, profile?.kids]);

  useEffect(() => {
    if (tv && p && root.current && !root.current.contains(document.activeElement)) {
      const grid = root.current.querySelector<HTMLElement>(".tv-grid");
      focusFirst(grid ?? root.current);
    }
  }, [tv, p]);

  if (error && !p) return <div className={tv ? "tv-page" : "m-page"}><PageHeader title="Cast & Crew" /><ErrorState message={error.message} onRetry={() => mutate()} /></div>;
  if (!p) {
    return (
      <div className={tv ? "tv-page tv-person" : "m-page m-person"} aria-busy="true">
        {!tv && <PageHeader title="" />}
        <div className="person-head"><Skeleton className="person-photo" /><div className="person-text"><Skeleton className="sk-line sk-line--title" /><Skeleton className="sk-line" /><Skeleton className="sk-line" /></div></div>
      </div>
    );
  }

  const facts = personFacts(p);
  const bio = p.biography?.trim() ?? "";
  const long = bio.length > (tv ? 520 : 300);
  return (
    <div ref={root} className={tv ? "tv-page tv-person" : "m-page m-person"} data-scroll-y={tv ? "item" : undefined} data-scroll-offset="0.3">
      {!tv && <PageHeader title="" />}
      <section className="person-head">
        <Img src={p.profileLarge ?? p.profile} alt="" title={p.name} className="person-photo" eager />
        <div className="person-text">
          <h1 className="person-name">{p.name}</h1>
          {facts.length > 0 && <p className="person-facts">{facts.map((f) => <span key={f}>{f}</span>)}</p>}
          {bio && <p className={`person-bio ${long && !open ? "is-clamped" : ""}`}>{bio}</p>}
          {long && (
            <button id="person-more" className={tv ? "tv-chip" : "m-link"} onClick={() => setOpen((o) => !o)} aria-expanded={open} data-hover-focus>
              {open ? "Show less" : "Read more"}
            </button>
          )}
        </div>
      </section>
      {known.length > 0 && (
        <section aria-label="Known For">
          <h2 className={tv ? "tv-row-title" : "m-row-title"}>Known For</h2>
          <div className={tv ? "tv-grid" : "m-grid"}>
            {known.map((it, i) => (
              <div key={it.id} className="person-credit">
                {tv ? <TvPoster item={it} id={`known-${i}`} expand={false} /> : <MPoster item={it} />}
                {it.role && <span className="person-role">{it.role}</span>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
