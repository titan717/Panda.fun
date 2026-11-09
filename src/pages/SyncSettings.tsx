import qrcode from "qrcode-generator";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Icon } from "../components/Icon";
import { Sheet } from "../components/Sheet";
import { toast } from "../components/ui";
import { useIsTv } from "../lib/layout";
import { useRemoteField } from "../lib/remoteInput";
import { createCode, getSyncStatus, normalizeCode, regenerateCode, restoreFromCode, revokeCode, subscribeSync, syncNow, SyncError, typingCode } from "../lib/sync";

/** "just now", "4 minutes ago", "yesterday at 21:10" … */
export function syncedAgo(at: number, now = Date.now()) {
  if (!at) return "Not synced yet";
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 45) return "Synced just now";
  const m = Math.round(s / 60);
  if (m < 60) return `Synced ${m} minute${m === 1 ? "" : "s"} ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `Synced ${h} hour${h === 1 ? "" : "s"} ago`;
  return `Synced ${new Date(at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`;
}

const waitText = (sec: number) => { const m = Math.ceil(sec / 60); return m <= 1 ? "a minute" : `${m} minutes`; };
const message = (e: unknown) => (e instanceof SyncError && e.kind === "locked" ? `${e.message.replace(/ Try again.*$/, "")} Try again in ${waitText(e.retryAfter)}.` : e instanceof Error ? e.message : "Sync failed");

/** The code as a QR, drawn as one SVG path so it stays sharp on 4K TVs. */
export function CodeQr({ text, size = 200 }: { text: string; size?: number }) {
  const d = useMemo(() => {
    const q = qrcode(0, "M");
    q.addData(text);
    q.make();
    const n = q.getModuleCount();
    let path = "";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) path += `M${c + 2} ${r + 2}h1v1h-1z`;
    return { path, n: n + 4 };
  }, [text]);
  return (
    <svg className="sync-qr" width={size} height={size} viewBox={`0 0 ${d.n} ${d.n}`} role="img" aria-label={`QR code for ${text}`} shapeRendering="crispEdges">
      <rect width={d.n} height={d.n} fill="#fff" />
      <path d={d.path} fill="#000" />
    </svg>
  );
}

function ShowCode({ code, fresh, onClose }: { code: string; fresh: boolean; onClose: () => void }) {
  const tv = useIsTv();
  return (
    <Sheet title={fresh ? "Your sync code is ready" : "Your sync code"} onClose={onClose} className="sync-sheet">
      <p className="sheet-sub">On your other device open Settings › Sync Code › Restore from code and type this code, or scan the QR with your phone's camera to copy it.</p>
      <div className="sync-code-card">
        <span id="sync-code-text" className="sync-code" aria-label={`Sync code ${code.split("").join(" ")}`}>{code}</span>
        <CodeQr text={code} />
      </div>
      <p className="set-note">Anyone with this code can open your backup. Keep it private; revoke it in Settings if it gets out.</p>
      <div className="form-actions lrud-container">
        <button className="btn btn--primary" data-autofocus onClick={onClose}>Done</button>
        {!tv && typeof navigator.clipboard?.writeText === "function" && (
          <button className="btn btn--secondary" onClick={() => { navigator.clipboard.writeText(code).then(() => toast("Code copied"), () => toast("Could not copy")); }}><Icon name="share" />Copy code</button>
        )}
      </div>
    </Sheet>
  );
}

function RestoreSheet({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const tv = useIsTv();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const field = useRemoteField(tv, () => document.getElementById("sync-restore-go")?.focus());
  const valid = normalizeCode(value) !== null;
  const go = async () => {
    if (!valid || busy) return;
    setBusy(true); setError(null);
    try {
      const r = await restoreFromCode(value);
      toast(r.added ? `Restored ${r.added} item${r.added === 1 ? "" : "s"} · ${r.profiles} profile${r.profiles === 1 ? "" : "s"}` : "This device is now synced");
      onDone();
    } catch (e) { setError(message(e)); } finally { setBusy(false); }
  };
  return (
    <Sheet title="Restore from code" onClose={onClose} className="sync-sheet">
      <p className="sheet-sub">Type the 12-character code shown on your other device. Profiles, lists, ratings, settings and watch progress are merged into this device; for anything changed on both, the newest change is kept.</p>
      <input id="sync-code-input" ref={field.ref} {...field.props} className={`sync-input ${error ? "is-error" : ""}`} value={value} placeholder="XXXX-XXXX-XXXX" aria-label="Sync code" autoCapitalize="characters" autoComplete="off" spellCheck={false}
        maxLength={14} data-autofocus onChange={(e) => { setValue(typingCode(e.target.value)); setError(null); }} onKeyDown={(e) => { field.props.onKeyDown?.(e); if (!tv && e.key === "Enter") void go(); }} />
      <p className={`set-note sync-msg ${error ? "is-error" : ""}`} role={error ? "alert" : undefined}>{error ?? (busy ? "Unlocking your backup…" : "Letters O, I and L are read as 0, 1 and 1.")}</p>
      <div className="form-actions lrud-container">
        <button id="sync-restore-go" className="btn btn--primary" disabled={!valid || busy} onClick={() => void go()}>{busy ? "Restoring…" : "Restore"}</button>
        <button className="btn btn--secondary" onClick={onClose}>Cancel</button>
      </div>
    </Sheet>
  );
}

function RevokeSheet({ onClose }: { onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <Sheet title="Revoke sync code?" onClose={onClose}>
      <p className="sheet-sub">The encrypted backup is deleted from the server and the code stops working everywhere. Your data stays on this device and on any device already synced.</p>
      <div className="form-actions lrud-container">
        <button id="sync-revoke-go" className="btn btn--primary" disabled={busy} data-autofocus onClick={() => {
          setBusy(true);
          revokeCode().then(() => { toast("Sync code revoked"); onClose(); }, (e) => { toast(message(e)); setBusy(false); });
        }}>{busy ? "Revoking…" : "Revoke code"}</button>
        <button className="btn btn--secondary" onClick={onClose}>Cancel</button>
      </div>
    </Sheet>
  );
}

function Row({ id, title, sub, icon, onClick, disabled }: { id: string; title: string; sub?: string; icon: "lock" | "download" | "refresh" | "close" | "sparkle"; onClick: () => void; disabled?: boolean }) {
  return (
    <button id={id} className="set-row" onClick={onClick} disabled={disabled} data-hover-focus>
      <span className="set-row-text"><span className="set-row-title">{title}</span>{sub && <span className="set-row-sub">{sub}</span>}</span>
      <Icon name={icon} />
    </button>
  );
}

/** Settings › Sync Code (v1.2.3, master mission §6). */
export function SyncPanel() {
  const st = useSyncExternalStore(subscribeSync, getSyncStatus, getSyncStatus);
  const [sheet, setSheet] = useState<null | "show" | "fresh" | "restore" | "revoke">(null);
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 30_000); return () => clearInterval(t); }, []);
  const run = (p: Promise<unknown>, ok: (v: never) => void) => p.then(ok as (v: unknown) => void, (e) => toast(message(e)));

  return (
    <div className="set-panel sync-panel">
      <p className="set-note">Move your profiles, lists, ratings, settings and watch progress to another phone, tablet or TV without an account. Everything is encrypted on this device with a key made from your code, so the server only stores data it cannot read.</p>
      {st.linked ? (
        <>
          <div className="sync-status" id="sync-status" aria-live="polite">
            <span className={`src-dot src-dot--${st.error ? "degraded" : "healthy"}`} aria-hidden="true" />
            <span>{st.busy ? "Syncing…" : st.error ? st.error : syncedAgo(st.lastSync)}</span>
          </div>
          {st.conflicts > 0 && !st.busy && <p className="set-note" id="sync-conflicts">{st.conflicts} item{st.conflicts === 1 ? " was" : "s were"} changed on two devices since the last sync; the newest change was kept.</p>}
          <Row id="sync-show" icon="lock" title="Show my code" sub={`${st.code!.slice(0, 4)}-••••-•••• · text and QR`} onClick={() => setSheet("show")} />
          <Row id="sync-now" icon="refresh" title="Sync now" sub="Also syncs by itself after changes and every 10 minutes" disabled={st.busy}
            onClick={() => run(syncNow(), (r: { added: number; conflicts: number }) => toast(r.added ? `Synced · ${r.added} update${r.added === 1 ? "" : "s"} from your other devices` : "Everything is up to date"))} />
          <Row id="sync-restore" icon="download" title="Restore from another code" sub="Switch this device to a different code" onClick={() => setSheet("restore")} />
          <Row id="sync-regen" icon="sparkle" title="Regenerate code" sub="New code for the same data; the old one stops working" disabled={st.busy}
            onClick={() => run(regenerateCode(), () => { toast("New sync code created"); setSheet("fresh"); })} />
          <Row id="sync-revoke" icon="close" title="Revoke code" sub="Delete the backup and turn sync off" disabled={st.busy} onClick={() => setSheet("revoke")} />
        </>
      ) : (
        <>
          <Row id="sync-create" icon="lock" title={st.busy ? "Creating your code…" : "Create sync code"} sub="Back up this device and get a code for your others" disabled={st.busy}
            onClick={() => run(createCode(), () => setSheet("fresh"))} />
          <Row id="sync-restore" icon="download" title="Restore from code" sub="Bring in profiles and progress from another device" onClick={() => setSheet("restore")} />
          {st.lockedUntil > Date.now() && <p className="set-note is-error">Too many wrong codes. Try again in {waitText((st.lockedUntil - Date.now()) / 1000)}.</p>}
        </>
      )}
      {(sheet === "show" || sheet === "fresh") && st.code && <ShowCode code={st.code} fresh={sheet === "fresh"} onClose={() => { setSheet(null); requestAnimationFrame(() => document.getElementById("sync-show")?.focus()); }} />}
      {sheet === "restore" && <RestoreSheet onClose={() => setSheet(null)} onDone={() => setSheet(null)} />}
      {sheet === "revoke" && <RevokeSheet onClose={() => { setSheet(null); requestAnimationFrame(() => document.getElementById("sync-create")?.focus()); }} />}
    </div>
  );
}
