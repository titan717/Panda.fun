import { afterEach, describe, expect, it, vi } from "vitest";
import { screenName, syncLink, titleLink, typeIntoTv } from "../lib/remote";
import { takeIncomingCode } from "../pages/SyncSettings";

import manifest from "../../android/app/src/main/AndroidManifest.xml?raw";
import links from "../../android/app/src/main/java/com/kinoma/tv/ui/DeepLinks.kt?raw";
import server from "../../android/app/src/main/java/com/kinoma/tv/remote/RemoteServer.kt?raw";
import activity from "../../android/app/src/main/java/com/kinoma/tv/ui/MainActivity.kt?raw";
import page from "../../android/app/src/main/assets/remote/index.html?raw";

describe("phone remote, web side (v1.2.4)", () => {
  afterEach(() => { document.body.innerHTML = ""; vi.restoreAllMocks(); });

  it("names every screen for the phone's On your TV card", () => {
    expect(screenName("/")).toBe("Home");
    expect(screenName("/title/movie/550")).toBe("Details");
    expect(screenName("/watch/tv/1/1/2")).toBe("Player");
    expect(screenName("/connect-phone")).toBe("Connect Phone");
    expect(screenName("/settings/sync")).toBe("Help & Settings");
    expect(screenName("/something-else")).toBe("Panda");
  });

  it("types into the focused field, else the search field, else opens Search", () => {
    const open = vi.fn();
    document.body.innerHTML = `<input id="other" type="text" maxlength="5">`;
    const other = document.getElementById("other") as HTMLInputElement;
    let typed = "";
    other.addEventListener("input", () => { typed = other.value; });
    other.focus();
    typeIntoTv("panda remote", open);
    expect(typed).toBe("panda");
    document.body.innerHTML = `<input id="search-input" type="search">`;
    typeIntoTv("dune", open);
    expect((document.getElementById("search-input") as HTMLInputElement).value).toBe("dune");
    document.body.innerHTML = "";
    typeIntoTv("  the batman ", open);
    expect(open).toHaveBeenCalledWith("/search?q=the%20batman");
    typeIntoTv("   ", open);
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("shares real web links on the API host, with the sync code kept in the fragment", () => {
    expect(titleLink("movie", 550)).toBe("https://apikinoma.vercel.app/p/movie/550");
    expect(syncLink("ABCD-EFGH-JKMN")).toBe("https://apikinoma.vercel.app/p/sync#ABCD-EFGH-JKMN");
  });

  it("takes a sync code handed over by a deep link and strips it from the address", () => {
    window.history.replaceState(null, "", "/settings/sync?code=abcd-efgh-jkmn&x=1");
    expect(takeIncomingCode()).toBe("ABCD-EFGH-JKMN");
    expect(window.location.search).toBe("?x=1");
    expect(takeIncomingCode()).toBeNull();
  });

  it("keeps the Android side wired: deep links, LAN server, bridge and the remote page", () => {
    expect(manifest).toContain('android:scheme="pandafun"');
    expect(manifest).toContain('android:host="apikinoma.vercel.app"');
    expect(links).toContain("/settings/sync?code=");
    expect(server).toContain("X-Panda-Code");
    expect(server).toMatch(/429/);
    for (const m of ["fun remoteInfo", "fun startRemote", "fun stopRemote", "fun resetRemote", "fun setRemoteState", "fun shareText"]) expect(activity).toContain(m);
    expect(page).toContain("Panda remote");
    expect(page).toContain("history.replaceState");
    expect(page).not.toMatch(/<script[^>]+src=/); // self-contained: nothing loads from the internet
  });
});
