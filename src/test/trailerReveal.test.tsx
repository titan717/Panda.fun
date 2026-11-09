import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { REVEAL_DELAY_MS, START_SECONDS, Trailer, trailerEmbedUrl } from "../components/Trailer";
import { unlockAudio } from "../lib/audio";

/** Fake YouTube IFrame API: one instance per created player, state driven by the test. */
interface Fake {
  state: number; muted: boolean; volume: number; t: number; d: number;
  events: { onReady: () => void; onStateChange: (e: { data: number }) => void; onError: () => void };
  calls: string[]; destroyed: boolean; frame: HTMLIFrameElement;
}
let players: Fake[] = [];
const P = (i: number): Fake => { const p = players[i]; if (!p) throw new Error(`no player ${i}`); return p; };

beforeEach(() => {
  vi.useFakeTimers();
  players = [];
  (window as unknown as { YT: unknown }).YT = {
    Player: class {
      f: Fake;
      constructor(el: HTMLElement, opts: { events: Fake["events"] }) {
        this.f = { state: -1, muted: true, volume: 100, t: 0, d: 120, events: opts.events, calls: [], destroyed: false, frame: el as HTMLIFrameElement };
        players.push(this.f);
      }
      playVideo() { this.f.calls.push("play"); }
      pauseVideo() { this.f.calls.push("pause"); }
      mute() { this.f.muted = true; }
      unMute() { this.f.muted = false; }
      isMuted() { return this.f.muted; }
      setVolume(v: number) { this.f.volume = v; }
      getPlayerState() { return this.f.state; }
      getCurrentTime() { return this.f.t; }
      getDuration() { return this.f.d; }
      seekTo(s: number) { this.f.calls.push(`seek:${s}`); this.f.t = s; }
      destroy() { this.f.destroyed = true; }
    }
  };
  // sound needs an unlocked audio context (first gesture)
  unlockAudio();
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

const flush = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); };
const ready = async (i?: number) => { await flush(); const p = P(i ?? players.length - 1); await act(async () => { p.events.onReady(); }); };
const state = async (data: number, i = players.length - 1) => { await act(async () => { P(i).state = data; P(i).events.onStateChange({ data }); }); };
const wait = async (ms: number) => { await act(async () => { vi.advanceTimersByTime(ms); }); };
const box = (c: HTMLElement) => c.querySelector(".trailer") as HTMLElement;

describe("trailer reveal delay (no YouTube branding flash)", () => {
  it("stays hidden and silent for REVEAL_DELAY_MS after PLAYING, then shows, reports and ramps the sound in", async () => {
    const onPlaying = vi.fn();
    const { container } = render(<Trailer keys={["abc"]} play sound volume={0.5} onPlaying={onPlaying} />);
    await ready();
    await state(1);
    expect(REVEAL_DELAY_MS).toBeGreaterThanOrEqual(1500);
    await wait(REVEAL_DELAY_MS - 50);
    expect(box(container).classList.contains("is-visible")).toBe(false);
    expect(P(0).muted).toBe(true);
    expect(P(0).volume).toBe(0);
    expect(onPlaying).not.toHaveBeenCalled();
    await wait(60);
    expect(box(container).classList.contains("is-visible")).toBe(true);
    expect(onPlaying).toHaveBeenCalledTimes(1);
    expect(P(0).muted).toBe(false);
    await wait(700);
    expect(P(0).volume).toBe(50);
  });

  it("starts background trailers about a second in and keeps the crop", () => {
    expect(START_SECONDS).toBe(1);
    expect(new URL(trailerEmbedUrl("abc", "https://x.test", START_SECONDS)).searchParams.get("start")).toBe("1");
    expect(new URL(trailerEmbedUrl("abc", "https://x.test")).searchParams.get("start")).toBeNull();
  });

  it("never reveals after play=false, unmount, a key change or another trailer starting", async () => {
    const a = render(<Trailer keys={["k1"]} play sound={false} volume={1} />);
    await ready(0); await state(1, 0);
    a.rerender(<Trailer keys={["k1"]} play={false} sound={false} volume={1} />);
    await wait(REVEAL_DELAY_MS + 100);
    expect(box(a.container).classList.contains("is-visible")).toBe(false);
    expect(P(0).calls).toContain("pause");

    // key change: the old player's timer must not reveal the new frame
    a.rerender(<Trailer keys={["k2"]} play sound={false} volume={1} />);
    await wait(REVEAL_DELAY_MS - 500);
    expect(P(0).destroyed).toBe(true);
    await ready(1);
    await wait(600);
    expect(box(a.container).classList.contains("is-visible")).toBe(false);

    // another trailer starts during the delay → this one is stopped and stays hidden
    await state(1, 1);
    const b = render(<Trailer keys={["k3"]} play sound={false} volume={1} />);
    await ready(2);
    await wait(REVEAL_DELAY_MS + 100);
    expect(box(a.container).classList.contains("is-visible")).toBe(false);
    expect(P(1).calls).toContain("pause");

    // unmount during the delay
    await state(1, 2);
    b.unmount();
    await wait(REVEAL_DELAY_MS + 100);
    expect(P(2).destroyed).toBe(true);
  });

  it("a pause or buffer during the delay restarts it", async () => {
    const { container } = render(<Trailer keys={["abc"]} play sound={false} volume={1} />);
    await ready(); await state(1);
    await wait(1500); await state(3); await state(1);
    await wait(1500);
    expect(box(container).classList.contains("is-visible")).toBe(false);
    await wait(600);
    expect(box(container).classList.contains("is-visible")).toBe(true);
  });

  it("stays visible through a loop", async () => {
    const { container } = render(<Trailer keys={["abc"]} play sound={false} volume={1} />);
    await ready(); await state(1); await wait(REVEAL_DELAY_MS + 50);
    expect(box(container).classList.contains("is-visible")).toBe(true);
    P(0).t = 119; await wait(450);
    expect(P(0).calls).toContain("seek:0");
    await state(3); await wait(1200);
    expect(box(container).classList.contains("is-visible")).toBe(true);
    await state(0); await wait(100);
    expect(box(container).classList.contains("is-visible")).toBe(true);
    await state(1); await wait(100);
    expect(box(container).classList.contains("is-visible")).toBe(true);
  });

  it("moves to the next key on an error during the delay, then fails to the backdrop", async () => {
    const onFail = vi.fn();
    const { container } = render(<Trailer keys={["a", "b"]} play sound={false} volume={1} onFail={onFail} />);
    await ready(0); await state(1, 0);
    await act(async () => { P(0).events.onError(); });
    await wait(REVEAL_DELAY_MS + 100);
    expect(box(container).classList.contains("is-visible")).toBe(false);
    expect(P(0).destroyed).toBe(true);
    await ready(1);
    expect(P(1).frame.getAttribute("src")).toContain("/embed/b?");
    await act(async () => { P(1).events.onError(); });
    await flush();
    expect(onFail).toHaveBeenCalledTimes(1);
  });

  it("the full-screen viewer (revealDelayMs 0) shows as soon as it plays", async () => {
    const onPlaying = vi.fn();
    render(<Trailer keys={["abc"]} play sound volume={1} loop={false} revealDelayMs={0} onPlaying={onPlaying} />);
    await ready(); await state(1); await wait(5);
    expect(onPlaying).toHaveBeenCalledTimes(1);
    expect(P(0).frame.getAttribute("src")).not.toContain("start=");
  });
});
