import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

/** v1.2.4: Connect Phone (phone as a remote over the local network), share links and sync links. */
const STATE = JSON.stringify({ profiles: [{ id: "pa", name: "Ana", avatar: "smile", kids: false, createdAt: 1 }], activeProfileId: "pa", prefs: { autoplayTrailers: false }, data: { pa: {} } });

/** A stand-in for the Android bridge's remote methods (MainActivity.remoteInfo & co.). Since v1.2.6 gated methods take the bridge key first. */
async function fakeBridge(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    let on = false, phones = 0, code = "K7QD-2M9X";
    const info = () => JSON.stringify({ on, enabled: on, ip: on ? "192.168.1.40" : null, port: on ? 8765 : null, code, phones, address: on ? "192.168.1.40:8765" : undefined, url: on ? `http://192.168.1.40:8765/#${code.replace("-", "")}` : undefined });
    const calls: string[] = [];
    w.__bridgeCalls = calls;
    w.__bridgeConnect = () => { phones = 1; (w.__pandaRemote as (e: string, n: number) => void)?.("connected", 1); };
    w.KinomaNative = {
      remoteInfo: info, startRemote: () => { on = true; calls.push("start"); return info(); }, stopRemote: () => { on = false; phones = 0; calls.push("stop"); return info(); },
      resetRemote: () => { code = "W3PH-8RTV"; phones = 0; calls.push("reset"); return info(); },
      setRemoteState: (_k: string, s: string) => { calls.push(`state:${s}`); }, shareText: (_k: string, t: string, x: string) => { calls.push(`share:${t}|${x}`); },
    };
  });
}

async function boot(page: Page, path: string, layout: "tv" | "mobile") {
  await page.route("https://api.github.com/**", (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ tag_name: "v0.0.1", assets: [] }) }));
  await page.addInitScript((s) => { localStorage.setItem("panda:v1:state", s); sessionStorage.setItem("panda:splash", "1"); }, STATE);
  await page.goto(`${path}${path.includes("?") ? "&" : "?"}layout=${layout}`, { waitUntil: "domcontentloaded" });
}

test("TV: Connect Phone heads the sidebar and pairs with a QR code", async ({ page }, info) => {
  test.skip(!info.project.metadata.tv, "TV screen");
  await fakeBridge(page);
  await boot(page, "/connect-phone", "tv");
  await expect(page.locator("#cp-code")).toHaveText("K7QD-2M9X", { timeout: 30_000 });
  await expect(page.locator(".cp-qr")).toBeVisible();
  await expect(page.locator("#cp-address")).toHaveText("192.168.1.40:8765");
  await expect(page.locator("#cp-status")).toContainText("Waiting for your phone");
  const ids = await page.locator(".rail-item").evaluateAll((els) => els.map((e) => e.id));
  expect(ids[0]).toBe("rail-phone");
  expect(await page.evaluate(() => (window as unknown as { __bridgeCalls: string[] }).__bridgeCalls)).toContain("start");
  // a phone connects: toast and live status
  await page.evaluate(() => (window as unknown as { __bridgeConnect: () => void }).__bridgeConnect());
  await expect(page.getByText("Phone connected as a remote")).toBeVisible();
  await expect(page.locator("#cp-status")).toContainText("1 phone connected");
  // new code disconnects every phone; turning off hides the QR
  // TV is driven with the remote's OK key
  await page.locator("#cp-reset").focus(); await page.keyboard.press("Enter");
  await expect(page.locator("#cp-code")).toHaveText("W3PH-8RTV");
  await page.locator("#cp-off").focus(); await page.keyboard.press("Enter");
  await expect(page.locator(".cp-qr")).toHaveCount(0);
  await expect(page.locator("#cp-on")).toBeVisible();
});

test("TV: typing from the phone fills the TV search, and the screen is reported", async ({ page }, info) => {
  test.skip(!info.project.metadata.tv, "TV screen");
  await fakeBridge(page);
  await boot(page, "/search", "tv");
  await expect(page.locator("#search-input")).toBeAttached({ timeout: 30_000 });
  await page.waitForFunction(() => typeof (window as unknown as { __pandaRemoteText?: unknown }).__pandaRemoteText === "function");
  await page.evaluate(() => (window as unknown as { __pandaRemoteText: (t: string) => void }).__pandaRemoteText("dune"));
  await expect(page.locator("#search-input")).toHaveValue("dune");
  const calls = await page.evaluate(() => (window as unknown as { __bridgeCalls: string[] }).__bridgeCalls);
  expect(calls.some((c) => c.includes('"screen":"Search"'))).toBe(true);
});

test("Without the Android app, Connect Phone explains how to pair and the sidebar hides it", async ({ page }, info) => {
  test.skip(!info.project.metadata.tv, "TV screen");
  await boot(page, "/connect-phone", "tv");
  await expect(page.getByText("Use your phone as a TV remote")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#rail-phone")).toHaveCount(0);
});

test("Phone remote page: pairs from the QR fragment, sends keys, shares the title on the TV", async ({ page }, info) => {
  test.skip(Boolean(info.project.metadata.tv), "phone page");
  const html = readFileSync("android/app/src/main/assets/remote/index.html", "utf8");
  const sent: { path: string; code: string | undefined; session: string | undefined; body: string }[] = [];
  const TOKEN = "ab".repeat(32);
  await page.route("http://192.168.1.40:8765/**", async (r) => {
    const url = new URL(r.request().url());
    if (url.pathname === "/") return r.fulfill({ contentType: "text/html", body: html });
    const h = r.request().headers();
    sent.push({ path: url.pathname, code: h["x-panda-code"], session: h["x-panda-session"], body: r.request().postData() ?? "" });
    const state = { screen: "Details", type: "movie", id: 550, title: "Fight Club", poster: "https://image.tmdb.org/t/p/w342/x.jpg" };
    if (url.pathname === "/api/hello") {
      const ok = h["x-panda-code"] === "K7QD2M9X";
      return r.fulfill({ status: ok ? 200 : 401, contentType: "application/json", body: JSON.stringify(ok ? { ok: true, device: "Living room TV", state, session: TOKEN } : { ok: false, error: "WRONG_CODE", triesLeft: 7 }) });
    }
    const ok = h["x-panda-session"] === TOKEN;
    return r.fulfill({ status: ok ? 200 : 401, contentType: "application/json", body: JSON.stringify(ok ? { ok: true, device: "Living room TV", state } : { ok: false, error: "SESSION_EXPIRED" }) });
  });
  await page.addInitScript(() => { (navigator as unknown as { share: unknown }).share = (d: unknown) => { (window as unknown as { __shared: unknown }).__shared = d; return Promise.resolve(); }; });
  await page.goto("http://192.168.1.40:8765/#K7QD2M9X");
  await expect(page.locator("#status-text")).toHaveText("Connected to Living room TV");
  expect(page.url()).not.toContain("#"); // the code is taken out of the address bar
  await expect(page.locator("#now-title")).toHaveText("Fight Club");
  await page.getByRole("button", { name: "Up", exact: true }).click();
  await expect.poll(() => sent.some((s) => s.path === "/api/key" && s.body.includes('"up"') && s.session === TOKEN && !s.code)).toBe(true);
  // only the session token is stored, never the pairing code
  expect(await page.evaluate(() => [localStorage.getItem("panda-remote-session"), localStorage.getItem("panda-remote-code")])).toEqual([TOKEN, null]);
  await page.locator("#share").click();
  expect(await page.evaluate(() => (window as unknown as { __shared: { url: string } }).__shared.url)).toBe("https://apikinoma.vercel.app/p/movie/550");
  // a wrong code goes back to pairing
  await page.locator("#unpair").click();
  await page.locator("#code").fill("ABCD2345");
  await page.locator("#pair-go").click();
  await expect(page.locator("#pair-err")).toContainText("didn't match");
  // an expired session sends the phone back to pairing with a clear message
  await page.evaluate(() => localStorage.setItem("panda-remote-session", "cd".repeat(32)));
  await page.goto("http://192.168.1.40:8765/");
  await expect(page.locator("#pair-err")).toContainText("disconnected");
  expect(await page.evaluate(() => localStorage.getItem("panda-remote-session"))).toBeNull();
});

test("Mobile Details shares a real web link (the in-app address is not reachable elsewhere)", async ({ page }, info) => {
  test.skip(Boolean(info.project.metadata.tv), "phone layout");
  await page.addInitScript(() => { (navigator as unknown as { share: unknown }).share = (d: unknown) => { (window as unknown as { __shared: unknown }).__shared = d; return Promise.resolve(); }; });
  await boot(page, "/title/movie/550", "mobile");
  const share = page.getByRole("button", { name: "Share" });
  await expect(share).toBeVisible({ timeout: 30_000 });
  await share.click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __shared?: { url: string } }).__shared?.url)).toBe("https://apikinoma.vercel.app/p/movie/550");
});

test("Sync code QR carries a share-page link and a ?code= deep link opens Restore", async ({ page }, info) => {
  test.skip(Boolean(info.project.metadata.tv), "phone layout");
  await boot(page, "/settings/sync?code=abcd-efgh-jkmn", "mobile");
  await expect(page.locator(".sheet")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".sheet input")).toHaveValue("ABCD-EFGH-JKMN");
  expect(page.url()).not.toContain("code=");
});
