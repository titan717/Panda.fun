/**
 * Kids PIN at rest (v1.2.7, SECURITY A127-1): stored as PBKDF2-SHA-256 with a random 16-byte salt,
 * never as the digits. Honest limit: a 4-digit PIN has only 10 000 values, so anyone who can read
 * this device's storage can still try them all offline; the hash keeps the PIN out of plain sight
 * (backups, synced copies, a glance at storage) and makes each guess cost a PBKDF2 run.
 */
const ITER = 120_000;
const PREFIX = "pbkdf2-sha256";

const b64 = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b instanceof Uint8Array ? b : new Uint8Array(b))));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(pin: string, salt: Uint8Array, iter: number) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  return crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations: iter }, key, 256);
}

export const isHashedPin = (stored: string | null | undefined): stored is string => typeof stored === "string" && stored.startsWith(`${PREFIX}$`);

/** `pbkdf2-sha256$<iterations>$<salt>$<hash>` (base64). */
export async function hashPin(pin: string, salt: Uint8Array = crypto.getRandomValues(new Uint8Array(16)), iter = ITER): Promise<string> {
  return `${PREFIX}$${iter}$${b64(salt)}$${b64(await derive(pin, salt, iter))}`;
}

/** Constant-time comparison, so the check does not leak how many characters matched. */
function same(a: string, b: string) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

/** True when `pin` matches the stored value; also accepts a pre-v1.2.7 plain PIN (migrated by the caller). */
export async function verifyPin(pin: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false;
  if (!isHashedPin(stored)) return same(pin, stored);
  const [, iter, salt, hash] = stored.split("$");
  const n = Number(iter);
  if (!salt || !hash || !Number.isInteger(n) || n < 1000 || n > 10_000_000) return false;
  try { return same(b64(await derive(pin, unb64(salt), n)), hash); } catch { return false; }
}

/** Replaces a plain PIN left by an older version with its hash. */
export async function upgradePin(stored: string | null | undefined, save: (hashed: string) => void) {
  if (!stored || isHashedPin(stored) || !/^\d{4}$/.test(stored) || !globalThis.crypto?.subtle) return;
  save(await hashPin(stored));
}
