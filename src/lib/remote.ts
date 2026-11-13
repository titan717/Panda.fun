import { native } from "./native";
import { introActive } from "./launch";
import { toast } from "../components/ui";

/**
 * v1.2.4 phone remote. The Android app runs a small server on the local network
 * (android/.../remote/RemoteServer.kt); this module is the web side: status, typing from the phone,
 * "Phone connected" toasts and the "On your TV" card the phone shows.
 */
export interface RemoteInfo { on: boolean; enabled: boolean; ip: string | null; port: number | null; code: string; phones: number; address?: string; url?: string }

export const remoteSupported = () => typeof native?.remoteInfo === "function";

const parse = (raw: string | undefined): RemoteInfo | null => {
  try { return raw ? (JSON.parse(raw) as RemoteInfo) : null; } catch { return null; }
};
export const getRemoteInfo = () => parse(native?.remoteInfo?.());
export const startRemote = () => parse(native?.startRemote?.());
export const stopRemote = () => parse(native?.stopRemote?.());
export const resetRemote = () => parse(native?.resetRemote?.());

/** What the phone shows under "On your TV". */
export interface RemoteTitle { type: "movie" | "tv"; id: number; title: string; poster?: string | null; playing?: boolean }

const SCREENS: [RegExp, string][] = [
  [/^\/$/, "Home"], [/^\/search/, "Search"], [/^\/movies/, "Movies"], [/^\/tv$/, "TV"], [/^\/new/, "New & Hot"],
  [/^\/categories|^\/browse/, "Categories"], [/^\/my-space|^\/my-list|^\/continue-watching/, "My Space"],
  [/^\/settings/, "Help & Settings"], [/^\/connect-phone/, "Connect Phone"], [/^\/title\//, "Details"], [/^\/watch\//, "Player"],
  [/^\/person\//, "Cast"], [/^\/collection\//, "Collection"], [/^\/anime/, "Anime"], [/^\/calendar/, "Calendar"], [/^\/profiles/, "Profiles"]
];
export const screenName = (path: string) => SCREENS.find(([re]) => re.test(path))?.[1] ?? "Panda";

let title: RemoteTitle | null = null;
const currentPath = () => (window.location.hash ? window.location.hash.slice(1).split("?")[0] || "/" : window.location.pathname);

function publish() {
  const path = currentPath();
  if (title && !path.includes(`/${title.type}/${title.id}`)) title = null;
  const state = { screen: screenName(path), ...(title ?? {}) };
  try { native?.setRemoteState?.(JSON.stringify(state)); } catch { /* bridge gone */ }
  return state;
}

/** Details and the player say which title is on screen (shown and shareable on the phone). */
export function setRemoteTitle(t: RemoteTitle | null) {
  if (!remoteSupported()) return;
  title = t;
  publish();
}

/** Text from the phone: into the focused field, else the search field, else open Search with it. */
export function typeIntoTv(text: string, open: (path: string) => void) {
  const active = document.activeElement;
  let field = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement ? active : null;
  if (field && field instanceof HTMLInputElement && !["text", "search", "password", "email", "url", "tel", ""].includes(field.type)) field = null;
  if (!field) {
    const search = document.getElementById("search-input");
    if (search instanceof HTMLInputElement) { search.focus(); field = search; }
  }
  if (!field) { if (text.trim()) open(`/search?q=${encodeURIComponent(text.trim())}`); return; }
  const value = field.maxLength > 0 ? text.slice(0, field.maxLength) : text;
  const proto = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(field, value);
  field.dispatchEvent(new Event("input", { bubbles: true }));
}

/** Public pages on the API host (movieapi src/panda/share.ts); the Android app opens them as deep links. */
export const SHARE_BASE = "https://apikinoma.vercel.app/p";
export const titleLink = (type: string, id: number | string) => `${SHARE_BASE}/${type}/${id}`;
/** The code travels in the fragment, which browsers never send to the server. */
export const syncLink = (code: string) => `${SHARE_BASE}/sync#${code}`;

export const REMOTE_EVENT = "panda:remote";

/** Called once by the app (Android only): typing, connection toasts and screen tracking. */
export function installRemote(open: (path: string) => void) {
  // v1.3.0: nothing reaches the app while the launch intro plays (it cannot be skipped)
  window.__pandaRemoteText = (text) => { if (!introActive()) typeIntoTv(text, open); };
  window.__pandaRemote = (event, phones) => {
    if (event === "connected") toast(phones > 1 ? `${phones} phones connected as remotes` : "Phone connected as a remote");
    window.dispatchEvent(new CustomEvent(REMOTE_EVENT));
  };
  window.addEventListener("hashchange", publish);
  window.addEventListener("popstate", publish);
  publish();
}
