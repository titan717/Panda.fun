import type { PlaybackSource, SourceId } from "./types";

/** Normalised events from the two embed protocols (docs/PLAYER_COMPARISON.md). */
export type PlayerEvent =
  | { kind: "ready" }
  | { kind: "play" }
  | { kind: "pause" }
  | { kind: "time"; position: number; duration: number }
  | { kind: "ended" }
  | { kind: "episode"; season: number; episode: number; internal: boolean }
  | { kind: "close" }
  | { kind: "error"; message: string };

export function parseMessage(source: PlaybackSource, origin: string, data: unknown): PlayerEvent | null {
  if (origin !== source.origin || !data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (source.events === "cinesrc" && typeof d.type === "string" && d.type.startsWith("cinesrc:")) {
    const p = (d.data && typeof d.data === "object" ? d.data : d) as Record<string, unknown>;
    switch (d.type) {
      case "cinesrc:ready": case "cinesrc:loadedmetadata": return { kind: "ready" };
      case "cinesrc:play": return { kind: "play" };
      case "cinesrc:pause": return { kind: "pause" };
      case "cinesrc:timeupdate": case "cinesrc:seeked": return { kind: "time", position: Number(p.currentTime) || 0, duration: Number(p.duration) || 0 };
      case "cinesrc:ended": return { kind: "ended" };
      case "cinesrc:nextepisode": return { kind: "episode", season: Number(p.season) || 1, episode: Number(p.episode) || 1, internal: p.internalNavigation === true };
      case "cinesrc:close": return { kind: "close" };
      case "cinesrc:error": return { kind: "error", message: String(p.error ?? "Playback error") };
    }
    return null;
  }
  if (source.events === "vidsrc" && d.type === "PLAYER_EVENT" && d.data && typeof d.data === "object") {
    const p = d.data as { player_status?: string; player_progress?: number; player_duration?: number };
    const position = Number(p.player_progress) || 0, duration = Number(p.player_duration) || 0;
    switch (p.player_status) {
      case "playing": return { kind: "time", position, duration };
      case "paused": return { kind: "pause" };
      case "seeked": return { kind: "time", position, duration };
      case "completed": return { kind: "ended" };
    }
  }
  return null;
}

export type PlayerCommand = { c: "play" } | { c: "pause" } | { c: "seekBy"; by: number; from: number } | { c: "volume"; value: number };

export function sendCommand(frame: HTMLIFrameElement | null, source: PlaybackSource, cmd: PlayerCommand) {
  const w = frame?.contentWindow;
  if (!w) return;
  if (source.events === "cinesrc") {
    const msg = cmd.c === "play" ? { command: "play", args: [] }
      : cmd.c === "pause" ? { command: "pause", args: [] }
      : cmd.c === "seekBy" ? { command: "seek", args: [Math.max(0, cmd.from + cmd.by)] }
      : { command: "setVolume", args: [Math.max(0, Math.min(1, cmd.value))] };
    w.postMessage({ type: "cinesrc:command", ...msg }, source.origin);
  } else if (source.events === "vidsrc") {
    const action = cmd.c === "play" ? "play" : cmd.c === "pause" ? "pause" : cmd.c === "seekBy" ? `seek${cmd.by >= 0 ? "+" : "-"}${Math.abs(cmd.by)}` : cmd.value <= 0 ? "mute" : "unmute";
    w.postMessage({ player: true, action }, source.origin);
  }
}

/** Our own countdown drives next-episode for every source, so provider auto-next is turned off. */
export function embedUrl(source: PlaybackSource) {
  try {
    const u = new URL(source.url);
    if (source.events === "cinesrc") { u.searchParams.set("autonext", "false"); u.searchParams.set("back", "close"); }
    if (source.events === "vidsrc") u.searchParams.set("autonext", "0");
    return u.toString();
  } catch { return source.url; }
}

export const SOURCE_ORDER: SourceId[] = ["cinesrc", "vidsrc", "vidsrc-mirror"];
export const READY_TIMEOUT_MS = 15_000;
