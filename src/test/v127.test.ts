import { beforeEach, describe, expect, it } from "vitest";
import { holdDelay, isCcKey, lookClass, saveSubMemory, subLook, subMemory, SUB_POS_MAX } from "../lib/captions";

const base = { subtitleSize: "medium" as const, subtitleStyle: "shadow" as const };

describe("subtitle look (v1.2.7)", () => {
  it("reads the v1.2.1 preset when the new controls were never touched", () => {
    expect(subLook({ ...base, subtitleStyle: "box" })).toEqual({ size: "medium", color: "white", bg: "box", edge: "none", pos: 0 });
    expect(subLook({ ...base, subtitleStyle: "yellow" })).toMatchObject({ color: "yellow", bg: "none", edge: "shadow" });
    expect(subLook({ ...base, subtitleStyle: "outline" })).toMatchObject({ edge: "outline" });
  });
  it("lets each new control override its part of the preset", () => {
    expect(subLook({ ...base, subtitleStyle: "box", subtitleColor: "cyan", subtitleEdge: "outline" })).toMatchObject({ color: "cyan", bg: "box", edge: "outline" });
  });
  it("clamps and rounds the height", () => {
    expect(subLook({ ...base, subtitlePos: -5 }).pos).toBe(0);
    expect(subLook({ ...base, subtitlePos: 99 }).pos).toBe(SUB_POS_MAX);
    expect(subLook({ ...base, subtitlePos: 7.6 }).pos).toBe(8);
    expect(subLook({ ...base, subtitlePos: Number.NaN }).pos).toBe(0);
  });
  it("builds one class per part", () => {
    expect(lookClass(subLook({ ...base, subtitleSize: "large", subtitleColor: "green", subtitleBg: "dim" }))).toBe("cap--large cap-c--green cap-bg--dim cap-e--shadow");
  });
});

describe("per-title subtitle memory (v1.2.7)", () => {
  beforeEach(() => localStorage.clear());
  it("keeps choices apart per profile and title and merges patches", () => {
    saveSubMemory("p1", "movie:550", { lang: "es", id: "es-1" }, 1);
    saveSubMemory("p1", "movie:550", { offset: 0.3 }, 2);
    saveSubMemory("p2", "movie:550", { off: true }, 3);
    expect(subMemory("p1", "movie:550")).toMatchObject({ lang: "es", id: "es-1", offset: 0.3 });
    expect(subMemory("p2", "movie:550")).toMatchObject({ off: true });
    expect(subMemory("p1", "tv:1")).toBeNull();
  });
  it("keeps only the newest 200 titles", () => {
    for (let i = 0; i < 205; i++) saveSubMemory("p1", `movie:${i}`, { offset: i }, i);
    expect(subMemory("p1", "movie:0")).toBeNull();
    expect(subMemory("p1", "movie:204")).toMatchObject({ offset: 204 });
    expect(Object.keys(JSON.parse(localStorage.getItem("panda:v1:subs")!))).toHaveLength(200);
  });
  it("survives broken or hostile storage", () => {
    localStorage.setItem("panda:v1:subs", "{not json");
    expect(subMemory("p1", "x")).toBeNull();
    localStorage.setItem("panda:v1:subs", JSON.stringify({ __proto__: { polluted: 1 } }));
    saveSubMemory("p1", "x", { offset: 1 }, 1);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe("hold and CC keys (v1.2.7)", () => {
  it("repeats faster the longer a timing button is held", () => {
    expect(holdDelay(0)).toBeGreaterThan(holdDelay(1));
    expect(holdDelay(1)).toBeGreaterThan(holdDelay(10));
    expect(holdDelay(10)).toBeGreaterThan(holdDelay(50));
  });
  const key = (k: Partial<KeyboardEvent>) => ({ key: "", keyCode: 0, ctrlKey: false, metaKey: false, altKey: false, target: null, ...k }) as Parameters<typeof isCcKey>[0];
  it("knows the remote CC keys and C on a keyboard, but not while typing or with modifiers", () => {
    expect(isCcKey(key({ key: "ClosedCaptionToggle" }))).toBe(true);
    expect(isCcKey(key({ key: "Subtitle" }))).toBe(true);
    expect(isCcKey(key({ keyCode: 460 }))).toBe(true);
    expect(isCcKey(key({ key: "c" }))).toBe(true);
    expect(isCcKey(key({ key: "c", ctrlKey: true }))).toBe(false);
    expect(isCcKey(key({ key: "c", target: document.createElement("input") }))).toBe(false);
    expect(isCcKey(key({ key: "v" }))).toBe(false);
  });
});

describe("Kids PIN at rest (v1.2.7)", async () => {
  const { hashPin, isHashedPin, upgradePin, verifyPin } = await import("../lib/pin");
  const { lockFor } = await import("../components/PinDialog");
  it("stores a salted hash, never the digits", async () => {
    const a = await hashPin("1234", undefined, 2000);
    const b = await hashPin("1234", undefined, 2000);
    expect(isHashedPin(a)).toBe(true);
    expect(a).not.toContain("1234");
    expect(a).not.toBe(b); // a fresh salt each time
    expect(await verifyPin("1234", a)).toBe(true);
    expect(await verifyPin("1235", a)).toBe(false);
  });
  it("accepts and upgrades a plain PIN from an older version", async () => {
    expect(await verifyPin("4321", "4321")).toBe(true);
    expect(await verifyPin("0000", "4321")).toBe(false);
    let saved = "";
    await upgradePin("4321", (h) => { saved = h; });
    expect(isHashedPin(saved)).toBe(true);
    expect(await verifyPin("4321", saved)).toBe(true);
    saved = "";
    await upgradePin(saved || "pbkdf2-sha256$2000$x$y", (h) => { saved = h; });
    expect(saved).toBe("");
  });
  it("rejects malformed or absurd stored values", async () => {
    expect(await verifyPin("1234", null)).toBe(false);
    expect(await verifyPin("1234", "pbkdf2-sha256$abc$$")).toBe(false);
    expect(await verifyPin("1234", "pbkdf2-sha256$999999999$AAAA$AAAA")).toBe(false);
  });
  it("locks the pad after five wrong PINs, for longer each time", () => {
    expect(lockFor(4)).toBe(0);
    expect(lockFor(5)).toBe(30_000);
    expect(lockFor(6)).toBe(60_000);
    expect(lockFor(30)).toBe(15 * 60_000);
  });
});
