import "./calendar.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { PageHeader } from "../components/PageHeader";
import { EmptyState, ErrorState, Img, Skeleton } from "../components/ui";
import { Icon } from "../components/Icon";
import { useIsTv } from "../lib/layout";
import { focusFirst } from "../lib/focus";
import { useNav } from "../lib/nav";
import { actions } from "../lib/store";
import { alertSub, groupByDay, useCalendar, type Alert } from "../lib/calendar";
import { notifyPermission, requestNotify, type NotifyPermission } from "../lib/notify";

type Filter = "all" | "tv" | "movie";

function AlertCard({ a, id, tv, fresh }: { a: Alert; id: string; tv: boolean; fresh: boolean }) {
  const p = tv ? "tv" : "m";
  const sub = alertSub(a);
  const img = a.still ?? a.item.backdrop;
  return (
    <Link href={a.href} id={id} className={tv ? "tv-card tv-land cal-card" : "m-land m-land-link cal-card"} data-hover-focus
      aria-label={`${a.item.title}, ${sub}${fresh ? ", new" : ""}`}>
      <span className={`${p}-land-media`}>
        <Img src={img} alt="" title={a.item.title} />
        {fresh && <span className="cal-badge">{a.kind === "episode" ? "NEW EPISODE" : "OUT NOW"}</span>}
        <Icon name={a.aired ? "play" : "bell"} className={`${p}-land-play`} />
      </span>
      <span className={`${p}-land-title`}>{a.item.title}</span>
      <span className={`${p}-land-sub`}>{sub}</span>
    </Link>
  );
}

/** Coming Up (v1.1.7): new episodes and releases for everything the profile follows. */
export function CalendarPage() {
  const tv = useIsTv();
  const { go } = useNav();
  const cal = useCalendar();
  const [filter, setFilter] = useState<Filter>("all");
  const [perm, setPerm] = useState<NotifyPermission>(() => notifyPermission());
  const ref = useRef<HTMLDivElement>(null);
  const ready = !cal.loading;

  useEffect(() => { if (cal.fresh.length) actions.markAlertsSeen(); }, [cal.fresh.length]);
  useEffect(() => { if (tv && ready && ref.current && !ref.current.contains(document.activeElement)) focusFirst(ref.current); }, [tv, ready]);

  const pick = (l: Alert[]) => (filter === "all" ? l : l.filter((a) => a.item.type === filter));
  const fresh = pick(cal.fresh);
  const groups = useMemo(() => groupByDay(pick(cal.upcoming)), [cal.upcoming, filter]); // eslint-disable-line react-hooks/exhaustive-deps
  const total = cal.fresh.length + cal.upcoming.length;
  const mixed = [...cal.fresh, ...cal.upcoming].some((a) => a.item.type === "movie") && [...cal.fresh, ...cal.upcoming].some((a) => a.item.type === "tv");
  const grid = tv ? "tv-land-grid" : "m-land-grid";
  let n = 0;

  return (
    <div ref={ref} className={tv ? "tv-page tv-browse cal-page" : "m-page cal-page"} data-scroll-y={tv ? "item" : undefined}>
      <PageHeader title="Coming Up" fallback="/my-space" />
      {perm === "default" && total > 0 && (
        <div className={`cal-notify ${tv ? "is-tv" : ""}`}>
          <Icon name="bell" />
          <span>Get a notification when a new episode lands.</span>
          <button id="cal-allow" className={tv ? "tv-btn" : "btn btn--primary"} data-hover-focus onClick={async () => { const r = await requestNotify(); setPerm(r); if (r === "granted") actions.setPrefs({ notifications: true }); }}>Allow</button>
        </div>
      )}
      {mixed && (
        <section className={tv ? "tv-chips" : "m-chips"} aria-label="Filters">
          {(["all", "tv", "movie"] as const).map((f) => (
            <button key={f} id={`calf-${f}`} className={`${tv ? "tv-chip" : "m-chip"} ${filter === f ? "is-selected" : ""}`} aria-pressed={filter === f} onClick={() => setFilter(f)} data-hover-focus>
              {f === "all" ? `All ${total}` : f === "tv" ? "Shows" : "Movies"}
            </button>
          ))}
        </section>
      )}
      {cal.loading ? (
        <div className={grid}>{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className={tv ? "tv-land" : "m-land"} />)}</div>
      ) : cal.error && total === 0 ? (
        <ErrorState onRetry={cal.retry} />
      ) : cal.following === 0 || total === 0 ? (
        <EmptyState icon="bell" title={cal.following === 0 ? "Nothing to track yet" : "Nothing coming up"}
          sub={cal.following === 0 ? "Add shows to your Watchlist or tap Remind Me on an upcoming title, and new episodes and releases will show up here." : "New episodes and premieres from your Watchlist and reminders will appear here as soon as they're announced."}
          action={<button className="btn btn--primary" data-autofocus onClick={() => go("/new")}>Browse New & Hot</button>} />
      ) : (
        <>
          {fresh.length > 0 && (
            <section className="cal-group" aria-label="Out now">
              <h2 className={tv ? "tv-row-title" : "m-row-title"}>Out Now</h2>
              <div className={grid}>{fresh.map((a) => <AlertCard key={a.key} a={a} tv={tv} fresh id={`cal-${n++}`} />)}</div>
            </section>
          )}
          {groups.map((g) => (
            <section key={g.day} className="cal-group" aria-label={g.label}>
              <h2 className={tv ? "tv-row-title" : "m-row-title"}>{g.label}</h2>
              <div className={grid}>{g.items.map((a) => <AlertCard key={a.key} a={a} tv={tv} fresh={false} id={`cal-${n++}`} />)}</div>
            </section>
          ))}
          {fresh.length === 0 && groups.length === 0 && <EmptyState icon="bell" title="Nothing here" sub="Try another filter." />}
        </>
      )}
    </div>
  );
}
