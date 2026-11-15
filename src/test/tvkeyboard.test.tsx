import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import mainActivity from "../../android/app/src/main/java/com/kinoma/tv/ui/MainActivity.kt?raw";
import manifest from "../../android/app/src/main/AndroidManifest.xml?raw";
import tvSearchSrc from "../tv/TvSearch.tsx?raw";

/** v1.3.2 TV search keyboard: OK on a TV text field must really open the on-screen keyboard (Gboard in the app). */

type Hook = typeof import("../lib/remoteInput");

async function load(nativeBridge?: Record<string, unknown>): Promise<Hook> {
  vi.resetModules();
  if (nativeBridge) {
    const meta = document.createElement("meta");
    meta.name = "panda-bridge"; meta.content = "k3y";
    document.head.appendChild(meta);
    (window as { KinomaNative?: unknown }).KinomaNative = nativeBridge;
  }
  return import("../lib/remoteInput");
}

function Field({ hook, onDone, enabled = true }: { hook: Hook; onDone?: () => void; enabled?: boolean }) {
  const f = hook.useRemoteField(enabled, onDone, { mode: "search" });
  return <div><input ref={f.ref} id="q" {...f.props} /><button id="next">Next</button></div>;
}

const q = () => document.getElementById("q") as HTMLInputElement;
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

afterEach(() => {
  cleanup();
  delete (window as { KinomaNative?: unknown }).KinomaNative;
  delete window.__pandaIme;
  document.head.innerHTML = "";
});

describe("useRemoteField (browser, no native bridge)", () => {
  it("lands without a keyboard, OK opens it, and the field stays in keyboard mode", async () => {
    const hook = await load();
    render(<Field hook={hook} />);
    q().focus();
    expect(q().getAttribute("inputmode")).toBe("none");
    fireEvent.keyDown(q(), { key: "Enter" });
    await flush();
    // v1.3.1 bug: the blur() in the keyboard request ran onBlur, which flipped the field straight back to "none"
    expect(q().getAttribute("inputmode")).toBe("search");
    expect(document.activeElement).toBe(q());
  });

  it("Enter on the keyboard closes it and runs onDone; Escape closes it without leaving the page", async () => {
    const hook = await load();
    const done = vi.fn();
    render(<Field hook={hook} onDone={done} />);
    q().focus();
    fireEvent.click(q());
    await flush();
    expect(q().getAttribute("inputmode")).toBe("search");
    const esc = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    act(() => { q().dispatchEvent(esc); });
    expect(esc.defaultPrevented).toBe(true); // focus.ts skips Back for a prevented key
    expect(q().getAttribute("inputmode")).toBe("none");
    fireEvent.keyDown(q(), { key: "Enter" });
    await flush();
    fireEvent.keyDown(q(), { key: "Enter" });
    expect(done).toHaveBeenCalledTimes(1);
    expect(q().getAttribute("inputmode")).toBe("none");
  });

  it("typing on a hardware keyboard (desktop browser) submits with Enter instead of asking for a keyboard", async () => {
    const hook = await load();
    const done = vi.fn();
    render(<Field hook={hook} onDone={done} />);
    q().focus();
    fireEvent.input(q(), { target: { value: "dune" } });
    fireEvent.keyDown(q(), { key: "Enter" });
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("is a plain field off TV", async () => {
    const hook = await load();
    render(<Field hook={hook} enabled={false} />);
    expect(q().hasAttribute("inputmode")).toBe(false);
  });
});

describe("useRemoteField in the Android app", () => {
  it("asks the native side for the keyboard after the field switched to a real input mode, with the bridge key", async () => {
    const seen: (string | null)[] = [];
    const showKeyboard = vi.fn(function (this: unknown, key: string) { seen.push(key, q().getAttribute("inputmode")); return true; });
    const hideKeyboard = vi.fn();
    const hook = await load({ isTV: () => true, getAppVersion: () => "1.3.2", showKeyboard, hideKeyboard });
    const done = vi.fn();
    render(<Field hook={hook} onDone={done} />);
    q().focus();
    fireEvent.keyDown(q(), { key: "Enter" });
    await flush();
    expect(showKeyboard).toHaveBeenCalledTimes(1);
    expect(seen).toEqual(["k3y", "search"]);
    expect(document.activeElement).toBe(q()); // no blur/refocus dance in the app
    // the IME's Search key arrives as Enter: search runs, keyboard closes
    fireEvent.keyDown(q(), { key: "Enter" });
    expect(done).toHaveBeenCalledTimes(1);
    expect(hideKeyboard).toHaveBeenCalledWith("k3y");
  });

  it("goes back to remote mode when the IME is closed with Back on the keyboard", async () => {
    const hook = await load({ isTV: () => true, getAppVersion: () => "1", showKeyboard: () => true, hideKeyboard: () => undefined });
    render(<Field hook={hook} />);
    q().focus();
    fireEvent.keyDown(q(), { key: "Enter" });
    await flush();
    act(() => { window.__pandaIme?.(true); });
    expect(q().getAttribute("inputmode")).toBe("search");
    act(() => { window.__pandaIme?.(false); });
    expect(q().getAttribute("inputmode")).toBe("none");
    // OK opens it again rather than submitting
    fireEvent.keyDown(q(), { key: "Enter" });
    await flush();
    expect(q().getAttribute("inputmode")).toBe("search");
  });
});

describe("native side (source checks; no Android SDK in CI)", () => {
  it("restarts the input connection and shows the IME behind a bridge-key check", () => {
    expect(mainActivity).toMatch(/fun showKeyboard\(key: String\): Boolean \{\s*if \(!trusted\(key\)\) return false/);
    expect(mainActivity).toMatch(/fun hideKeyboard\(key: String\) \{\s*if \(!trusted\(key\)\) return/);
    expect(mainActivity).toContain("imm.restartInput(webView)");
    expect(mainActivity).toContain("imm.showSoftInput(webView, 0)");
    expect(mainActivity).toContain("window.__pandaIme && window.__pandaIme($ime)");
    expect(mainActivity).toContain("SOFT_INPUT_ADJUST_NOTHING");
    expect(manifest).toContain('android:windowSoftInputMode="stateHidden"');
  });
  it("TV search uses the shared remote field", () => {
    expect(tvSearchSrc).toContain("useRemoteField(true");
    expect(tvSearchSrc).toContain("{...field.props}");
    expect(tvSearchSrc).not.toContain("el.blur(); el.focus()");
  });
});
