import "./updates.css";
import { useEffect, useRef, useState } from "react";
import type React from "react";
import { Icon } from "../components/Icon";
import { PageHeader } from "../components/PageHeader";
import { ReleaseNotes } from "../components/ReleaseNotes";
import { Sheet } from "../components/Sheet";
import { Spinner } from "../components/ui";
import { fetchReleaseNotes, installedVersion } from "../lib/updates";
import { useIsTv } from "../lib/layout";

type Notes = { s: "loading" } | { s: "ok"; text: string } | { s: "error"; message: string };

function useNotes(version: string) {
  const [notes, setNotes] = useState<Notes>({ s: "loading" });
  useEffect(() => {
    const ctrl = new AbortController();
    fetchReleaseNotes(version, ctrl.signal)
      .then((text) => setNotes({ s: "ok", text }))
      .catch((e: Error) => { if (!ctrl.signal.aborted) setNotes({ s: "error", message: navigator.onLine ? e.message : "Connect to the internet to see what's new." }); });
    return () => ctrl.abort();
  }, [version]);
  return notes;
}

function Body({ notes }: { notes: Notes }) {
  if (notes.s === "loading") return <div className="wn-loading"><Spinner /></div>;
  if (notes.s === "error") return <p className="upd-sub">{notes.message}</p>;
  return <ReleaseNotes text={notes.text} max={60} />;
}

/** Shown once after the app was updated (§7 "What's New after an update"). */
export function WhatsNewSheet({ version, onClose }: { version: string; onClose: () => void }) {
  const notes = useNotes(version);
  const tv = useIsTv();
  const done = useRef<HTMLButtonElement>(null);
  // The screen underneath autofocuses its first item after mounting; keep remote focus inside the sheet.
  useEffect(() => {
    const grab = () => { const b = done.current; if (b && !b.closest(".sheet")?.contains(document.activeElement)) b.focus({ preventScroll: true }); };
    grab();
    const timers = [80, 400, 1200].map((ms) => setTimeout(grab, ms));
    document.addEventListener("focusin", grab);
    return () => { timers.forEach(clearTimeout); document.removeEventListener("focusin", grab); };
  }, []);
  return (
    <Sheet title={`What's new in ${version}`} onClose={onClose} className={`whatsnew ${tv ? "whatsnew--tv" : ""}`} rootClassName={tv ? "sheet-root--side" : ""}>
      <p className="wn-kicker"><Icon name="sparkle" /> Panda.fun was updated</p>
      <div className="wn-body"><Body notes={notes} /></div>
      <button ref={done} className="btn btn--primary wn-done" data-autofocus onClick={onClose}>Got it</button>
    </Sheet>
  );
}

/** TV remote: Up/Down scroll the notes card; Up at the top falls through so focus can leave it. */
function scrollKeys(e: React.KeyboardEvent<HTMLDivElement>) {
  const el = e.currentTarget;
  const step = Math.round(el.clientHeight * 0.6);
  if (e.key === "ArrowDown" && el.scrollTop + el.clientHeight < el.scrollHeight - 2) { el.scrollBy({ top: step, behavior: "smooth" }); e.preventDefault(); e.stopPropagation(); }
  else if (e.key === "ArrowUp" && el.scrollTop > 2) { el.scrollBy({ top: -step, behavior: "smooth" }); e.preventDefault(); e.stopPropagation(); }
}

/** Settings › What's New: notes for the installed version. */
export function WhatsNewPage() {
  const version = installedVersion();
  const notes = useNotes(version);
  const tv = useIsTv();
  return (
    <div className={tv ? "tv-page tv-settings-page tv-updates" : "m-page m-updates"}>
      <PageHeader title="What's New" sub={`Version ${version}`} fallback="/settings" />
      <div className="upd-card wn-page" data-autofocus tabIndex={-1} onKeyDown={tv ? scrollKeys : undefined}><Body notes={notes} /></div>
    </div>
  );
}
