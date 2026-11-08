import type { PlaybackSource, SourceId } from "./types";

/**
 * Source registry, client side (docs/PLAYER_COMPARISON.md). The backend builds the embed URLs;
 * each adapter here declares what the embed can do and how to talk to it.
 */
export interface SourceAdapter {
  id: SourceId;
  short: string;
  /** Commands over postMessage (play/pause/seek/volume) → Panda draws the full custom transport. */
  commands: boolean;
  /** Embed hides its own chrome (controls=false) when Panda draws the transport. */
  hideControls: boolean;
  /** Preferred-quality URL parameter. */
  quality: boolean;
  hosts: string[];
}

export const ADAPTERS: Record<SourceId, SourceAdapter> = {
  cinesrc: { id: "cinesrc", short: "CineSrc", commands: true, hideControls: true, quality: true, hosts: ["cinesrc.st"] },
  vidy: { id: "vidy", short: "Vidy", commands: false, hideControls: false, quality: false, hosts: ["vidy.st", "www.vidy.st"] }
};

export const SOURCE_ORDER: SourceId[] = ["cinesrc", "vidy"];
export const READY_TIMEOUT_MS = 15_000;
export const sourceName = (id: SourceId) => ADAPTERS[id]?.short ?? id;

/** Normalised events from the two embed protocols. */
export type PlayerEvent =
  | { kind: "ready"; duration?: number }
  | { kind: "play" }
  | { kind: "pause" }
  | { kind: "time"; position: number; duration: number }
  | { kind: "ended" }
  | { kind: "episode"; season: number; episode: number; internal: boolean }
  | { kind: "volume"; volume: number; muted: boolean }
  | { kind: "close" }
  | { kind: "skipintro"; to: number }
  | { kind: "rate"; rate: number }
  | { kind: "error"; message: string };

function originMatches(source: PlaybackSource, origin: string) {
  try {
    const host = new URL(origin).hostname;
    return ADAPTERS[source.id]?.hosts.some((h) => host === h || host.endsWith(`.${h}`)) ?? origin === source.origin;
  } catch { return false; }
}

export function parseMessage(source: PlaybackSource, origin: string, raw: unknown): PlayerEvent | null {
  if (!originMatches(source, origin)) return null;
  let data = raw;
  if (typeof data === "string") { try { data = JSON.parse(data); } catch { return null; } }
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (source.events === "cinesrc" && typeof d.type === "string" && d.type.startsWith("cinesrc:")) {
    const p = (d.data && typeof d.data === "object" ? d.data : d) as Record<string, unknown>;
    switch (d.type) {
      case "cinesrc:ready": return { kind: "ready" };
      case "cinesrc:loadedmetadata": return { kind: "ready", duration: Number(p.duration) || undefined };
      case "cinesrc:play": return { kind: "play" };
      case "cinesrc:pause": return { kind: "pause" };
      case "cinesrc:timeupdate": case "cinesrc:seeked": return { kind: "time", position: Number(p.currentTime) || 0, duration: Number(p.duration) || 0 };
      case "cinesrc:ended": return { kind: "ended" };
      case "cinesrc:nextepisode": return { kind: "episode", season: Number(p.season) || 1, episode: Number(p.episode) || 1, internal: p.internalNavigation === true };
      case "cinesrc:volumechange": return { kind: "volume", volume: Number(p.volume) || 0, muted: p.muted === true };
      case "cinesrc:close": return { kind: "close" };
      case "cinesrc:skipintro": return { kind: "skipintro", to: Number(p.time) || 0 };
      case "cinesrc:ratechange": return { kind: "rate", rate: Number(p.playbackRate) || 1 };
      case "cinesrc:error": return { kind: "error", message: String(p.error ?? "Playback error") };
    }
    return null;
  }
  if (source.events === "vidy") {
    const p = (d.type === "PLAYER_EVENT" && d.data && typeof d.data === "object" ? d.data : d) as Record<string, unknown>;
    if (d.type !== "PLAYER_EVENT" && !("event" in p)) return null;
    const position = Number(p.currentTime ?? p.timestamp) || 0, duration = Number(p.duration) || 0;
    switch (p.event) {
      case "timeupdate": return { kind: "time", position, duration };
      case "play": return { kind: "play" };
      case "pause": return { kind: "pause" };
      case "ended": return { kind: "ended" };
    }
  }
  return null;
}

export type PlayerCommand = { c: "play" } | { c: "pause" } | { c: "seek"; to: number } | { c: "volume"; value: number } | { c: "muted"; value: boolean } | { c: "rate"; value: number };

export function sendCommand(frame: HTMLIFrameElement | null, source: PlaybackSource, cmd: PlayerCommand) {
  const w = frame?.contentWindow;
  if (!w || !ADAPTERS[source.id]?.commands) return false;
  const msg = cmd.c === "play" ? { command: "play", args: [] }
    : cmd.c === "pause" ? { command: "pause", args: [] }
    : cmd.c === "seek" ? { command: "seek", args: [Math.max(0, cmd.to)] }
    : cmd.c === "volume" ? { command: "setVolume", args: [Math.max(0, Math.min(1, cmd.value))] }
    : cmd.c === "muted" ? { command: "setMuted", args: [cmd.value] }
    : { command: "setPlaybackRate", args: [cmd.value] };
  w.postMessage({ type: "cinesrc:command", ...msg }, source.origin);
  return true;
}

/**
 * Final iframe URL: Panda's own chrome replaces the embed's controls where the adapter allows it.
 * `start` re-opens at a position (quality / controls changes reload the embed); `quality` is the
 * CineSrc preferred-quality hint ("auto" leaves the choice to the source).
 */
export function embedUrl(source: PlaybackSource, o: { customChrome: boolean; start?: number; quality?: string; autoskip?: boolean }) {
  try {
    const u = new URL(source.url);
    const start = o.start && o.start > 1 ? String(Math.floor(o.start)) : null;
    if (source.events === "cinesrc") {
      u.searchParams.set("autonext", "false");
      u.searchParams.set("back", "close");
      if (o.customChrome) u.searchParams.set("controls", "false");
      if (o.autoskip) u.searchParams.set("autoskip", "true");
      if (o.quality && o.quality !== "auto") u.searchParams.set("quality", o.quality);
      if (start) { u.searchParams.set("t", start); u.searchParams.set("continueprompt", "false"); }
    } else if (source.events === "vidy" && start) {
      u.searchParams.set("progress", start);
    }
    return u.toString();
  } catch { return source.url; }
}
