/**
 * Parental Controls PIN (spec 15.6), loaded on demand. v1.2.7 (SECURITY A127-1..3): the PIN is kept as a
 * salted PBKDF2 hash, wrong guesses lock the pad for a growing time, and grown-up settings (Parental
 * Controls, Manage Profiles) ask for the PIN while a Kids profile is active, so a child cannot simply
 * switch the PIN or the Kids flag off.
 */
import { useEffect, useState, type ReactNode } from "react";
import { Sheet } from "./Sheet";
import { toast } from "./ui";
import { actions, getState, useProfile, usePrefs } from "../lib/store";
import { hashPin, upgradePin, verifyPin } from "../lib/pin";
import { useNav } from "../lib/nav";

const LOCK_KEY = "panda:v1:pinlock";
const FREE_TRIES = 5;
/** Lock after the 5th wrong PIN in a row: 30 s, then doubling up to 15 minutes. Survives a reload. */
export function lockFor(fails: number) { return fails < FREE_TRIES ? 0 : Math.min(15 * 60_000, 30_000 * 2 ** (fails - FREE_TRIES)); }
function readLock(): { fails: number; until: number } {
  try {
    const v = JSON.parse(localStorage.getItem(LOCK_KEY) ?? "null") as { fails?: unknown; until?: unknown } | null;
    return { fails: Number(v?.fails) || 0, until: Number(v?.until) || 0 };
  } catch { return { fails: 0, until: 0 }; }
}
const writeLock = (v: { fails: number; until: number }) => { try { localStorage.setItem(LOCK_KEY, JSON.stringify(v)); } catch { /* storage full */ } };

/** Grown-up settings stay open for 10 minutes after the PIN was entered, in this tab only. */
let unlockedUntil = 0;
const UNLOCK_MS = 10 * 60_000;
export const parentUnlocked = () => Date.now() < unlockedUntil;

export function PinDialog({ title, onSuccess, onClose }: { title: string; onSuccess: () => void; onClose: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [lock, setLock] = useState(readLock);
  const locked = lock.until > now;
  useEffect(() => {
    if (!locked) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [locked]);
  const submit = async (v: string) => {
    if (busy || readLock().until > Date.now()) return;
    setBusy(true);
    const stored = getState().prefs.kidsPin;
    const ok = await verifyPin(v, stored);
    setBusy(false);
    if (ok) {
      writeLock({ fails: 0, until: 0 });
      void upgradePin(stored, (h) => actions.setPrefs({ kidsPin: h }));
      unlockedUntil = Date.now() + UNLOCK_MS;
      onSuccess();
      return;
    }
    const fails = readLock().fails + 1;
    const next = { fails, until: lockFor(fails) ? Date.now() + lockFor(fails) : 0 };
    writeLock(next); setLock(next); setNow(Date.now());
    setError(true); setPin("");
  };
  const press = (v: string) => { setPin(v); setError(false); if (v.length === 4) void submit(v); };
  const wait = Math.ceil((lock.until - now) / 1000);
  return (
    <Sheet title={title} onClose={onClose} className="pin-sheet">
      <p className="sheet-sub">Enter the 4-digit Parental Controls PIN.</p>
      <input className="pin-input" inputMode="numeric" pattern="[0-9]*" maxLength={4} autoFocus data-autofocus aria-label="PIN" type="password" value={pin} disabled={locked}
        onChange={(e) => press(e.target.value.replace(/\D/g, "").slice(0, 4))} />
      {locked ? <p className="pin-error" role="alert">Too many wrong PINs. Try again in {wait > 60 ? `${Math.ceil(wait / 60)} min` : `${wait} s`}.</p>
        : error && <p className="pin-error" role="alert">That PIN isn't right. Try again.</p>}
      <div className="pin-pad lrud-container">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((k, i) => k === "" ? <span key={i} /> : (
          <button key={i} id={`pin-${i}`} className="pin-key" data-hover-focus aria-label={k === "⌫" ? "Delete" : k} disabled={locked || busy}
            onClick={() => { if (k === "⌫") setPin((p) => p.slice(0, -1)); else press((pin + k).slice(0, 4)); }}>{k}</button>
        ))}
      </div>
    </Sheet>
  );
}

/** New or changed PIN: saved only as its hash. */
export function PinSetup({ onClose }: { onClose: () => void }) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { actions.setPrefs({ kidsPin: await hashPin(pin) }); toast("PIN saved"); onClose(); }
    catch { toast("This device can't store a PIN securely"); setBusy(false); }
  };
  return (
    <Sheet title="Set Parental Controls PIN" onClose={onClose}>
      <p className="sheet-sub">You'll need this PIN to switch from a Kids profile to another profile, and to change Parental Controls or profiles while a Kids profile is on.</p>
      <input className="pin-input" inputMode="numeric" maxLength={4} type="password" aria-label="New PIN" value={pin} data-autofocus autoFocus
        onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} />
      <div className="form-actions lrud-container">
        <button id="pin-save" className="btn btn--primary" disabled={pin.length !== 4 || busy} onClick={() => void save()}>Save PIN</button>
        <button className="btn btn--secondary" onClick={onClose}>Cancel</button>
      </div>
    </Sheet>
  );
}

/** Asks for the PIN before grown-up settings while a Kids profile is active and a PIN is set; Cancel goes back. */
export function ParentLock({ title, fallback = "/", children }: { title: string; fallback?: string; children: ReactNode }) {
  const profile = useProfile();
  const { kidsPin } = usePrefs();
  const [open, setOpen] = useState(() => parentUnlocked());
  const { back } = useNav();
  useEffect(() => { void upgradePin(kidsPin, (h) => actions.setPrefs({ kidsPin: h })); }, [kidsPin]);
  if (!profile?.kids || !kidsPin || open) return <>{children}</>;
  return <PinDialog title={title} onSuccess={() => setOpen(true)} onClose={() => back(fallback)} />;
}
