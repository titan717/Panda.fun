import { expect, test, type Page, type Route } from "@playwright/test";

/** v1.2.3: Sync code — create on one device, restore on another, sync both ways, revoke. */
const item = (n: number) => ({ id: `movie-${n}`, tmdbId: n, type: "movie", title: `Film ${n}`, year: 2020, rating: 7, poster: null, posterLarge: null, backdrop: null, backdropLarge: null, overview: null, genres: [] });
const STATE = (name: string, id: string, watchlist?: unknown[]) => JSON.stringify({
  profiles: [{ id, name, avatar: "smile", kids: false, createdAt: 1 }],
  activeProfileId: id, prefs: { autoplayTrailers: false },
  data: { [id]: watchlist ? { watchlist, lists: [{ id: "l1", name: "Weekend picks", items: [item(2)], createdAt: 1, updatedAt: 1 }], history: {}, ratings: {} } : {} },
});

/** Behaves like /api/v1/panda/sync on apikinoma: stores the ciphertext envelope, versions, 409/410. */
function fakeSync() {
  const store = new Map<string, { version: number; blob: string; updatedAt: number } | null>();
  const seen: string[] = [];
  const handle = async (route: Route) => {
    const req = route.request();
    const id = req.url().split("/").pop()!;
    const json = (status: number, body: unknown) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    const rec = store.get(id);
    if (req.method() === "GET") return rec ? json(200, { success: true, data: rec }) : json(404, { success: false, error: { code: "SYNC_NOT_FOUND", triesLeft: 4 } });
    if (req.method() === "DELETE") { if (!rec) return json(404, { success: false }); store.set(id, null); return json(200, { success: true, data: { revoked: true } }); }
    const body = JSON.parse(req.postData() ?? "{}") as { blob: string; base: number | null };
    seen.push(body.blob);
    if (body.base !== null && !rec) return json(410, { success: false, error: { code: "SYNC_REVOKED" } });
    if ((rec?.version ?? null) !== body.base) return json(409, { success: false, data: rec });
    const next = { version: (rec?.version ?? 0) + 1, blob: body.blob, updatedAt: Date.now() };
    store.set(id, next);
    return json(200, { success: true, data: { version: next.version, updatedAt: next.updatedAt } });
  };
  return { handle, seen };
}

async function open(page: Page, tv: boolean, state: string, sync: ReturnType<typeof fakeSync>) {
  await page.route("https://api.github.com/**", (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ tag_name: "v0.0.1", assets: [] }) }));
  await page.route(/\/api\/v1\/panda\/sync\//, sync.handle);
  await page.addInitScript((s) => { if (!localStorage.getItem("panda:v1:state")) localStorage.setItem("panda:v1:state", s); sessionStorage.setItem("panda:splash", "1"); }, state);
  await page.goto(`/settings/sync?layout=${tv ? "tv" : "mobile"}`, { waitUntil: "domcontentloaded" });
  // TV: the panel follows the focused section; the page focuses its first section once on mount, so focus Sync Code until it shows
  if (tv) await expect.poll(async () => { await page.locator("#set-sync").focus(); return page.locator("#sync-restore").isVisible(); }, { timeout: 30_000 }).toBe(true);
}

test("Create a sync code, restore it on another device, sync back and revoke", async ({ browser, page }, info) => {
  test.setTimeout(180_000);
  const tv = Boolean(info.project.metadata.tv);
  const sync = fakeSync();

  // device A: Ana with one title on her watchlist
  await open(page, tv, STATE("Ana", "pa", [item(1)]), sync);
  await page.locator("#sync-create").click();
  const codeEl = page.locator("#sync-code-text");
  await expect(codeEl).toBeVisible({ timeout: 30_000 });
  const code = (await codeEl.textContent())!;
  expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
  await expect(page.locator(".sync-qr")).toBeVisible();
  // the server only ever sees ciphertext
  expect(sync.seen.length).toBeGreaterThan(0);
  for (const blob of sync.seen) { expect(blob).not.toContain("Ana"); expect(blob).not.toContain("Weekend"); }
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.locator("#sync-status")).toContainText(/Synced just now/);

  // device B: a fresh install with its own starter profile
  const ctx = await browser.newContext({ viewport: page.viewportSize() ?? undefined });
  const b = await ctx.newPage();
  await open(b, tv, STATE("You", "pb"), sync);
  await b.locator("#sync-restore").click();
  const input = b.locator("#sync-code-input");
  await input.click();
  if (tv) await input.press("Enter");
  await input.pressSequentially("ZZZZZZZZZZZZ");
  await expect(input).toHaveValue("ZZZZ-ZZZZ-ZZZZ");
  await b.locator("#sync-restore-go").click();
  await expect(b.getByText(/No backup found for this code\. 4 tries left/)).toBeVisible({ timeout: 30_000 });
  await input.fill("");
  await input.pressSequentially(code.toLowerCase().replace(/-/g, ""));
  await b.locator("#sync-restore-go").click();
  // this device's unused starter profile gives way to the restored ones, so Panda asks who is watching
  await expect(b.getByRole("button", { name: "Ana", exact: true }).first()).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => b.evaluate(() => JSON.parse(localStorage.getItem("panda:v1:state") ?? "{}").profiles.map((p: { name: string }) => p.name).join())).toBe("Ana");
  const stateB = await b.evaluate(() => JSON.parse(localStorage.getItem("panda:v1:state") ?? "{}"));
  expect(stateB.profiles.map((p: { name: string }) => p.name)).toEqual(["Ana"]);
  expect(stateB.data.pa.watchlist.map((i: { id: string }) => i.id)).toEqual(["movie-1"]);
  expect(stateB.data.pa.lists[0].name).toBe("Weekend picks");

  // B picks Ana and adds a title (written like another tab would, so the store reloads it); A picks it up with Sync now
  await b.getByRole("button", { name: "Ana", exact: true }).first().click();
  await b.goto(`/settings/sync?layout=${tv ? "tv" : "mobile"}`, { waitUntil: "domcontentloaded" });
  if (tv) await expect.poll(async () => { await b.locator("#set-sync").focus(); return b.locator("#sync-now").isVisible(); }, { timeout: 30_000 }).toBe(true);
  await expect(b.locator("#sync-now")).toBeVisible({ timeout: 30_000 });
  await b.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("panda:v1:state")!);
    s.data.pa.watchlist.unshift({ ...s.data.pa.watchlist[0], id: "movie-7", tmdbId: 7, title: "Film 7" });
    localStorage.setItem("panda:v1:state", JSON.stringify(s));
    window.dispatchEvent(new StorageEvent("storage", { key: "panda:v1:state" }));
  });
  await b.locator("#sync-now").click();
  await expect(b.locator("#sync-status")).toContainText(/Synced just now/, { timeout: 30_000 });
  // B may already be saving by itself (20 s after a change); A asks until B's title arrives
  await expect.poll(async () => {
    if (await page.locator("#sync-now").isEnabled()) await page.locator("#sync-now").click();
    await page.waitForTimeout(1500);
    return page.evaluate(() => JSON.parse(localStorage.getItem("panda:v1:state")!).data.pa.watchlist.map((i: { id: string }) => i.id));
  }, { timeout: 60_000, intervals: [500] }).toEqual(["movie-7", "movie-1"]);
  // A revokes; B is told on its next sync and turns sync off
  await page.locator("#sync-revoke").click();
  await page.locator("#sync-revoke-go").click();
  await expect(page.locator("#sync-create")).toBeVisible({ timeout: 30_000 });
  await b.locator("#sync-now").click();
  await expect(b.getByText(/revoked or replaced on another device/).first()).toBeVisible({ timeout: 30_000 });
  await expect(b.locator("#sync-create")).toBeVisible();
  await ctx.close();
});
