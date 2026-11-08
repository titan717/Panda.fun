/* Panda.fun service worker (D-53): instant repeat loads and an offline app shell for the web app.
 * - Pages: network first (3 s), falling back to the cached shell, so a new deploy is picked up at once.
 * - /assets/*: hashed and immutable, so cache first.
 * - TMDB artwork: cache first (CORS responses only, so no opaque-response storage padding), capped at 500 images.
 * The Android app ships its files inside the APK and does not use this worker. */
const SHELL = "panda-shell-v1";
const ASSETS = "panda-assets-v1";
const IMAGES = "panda-img-v1";
const MAX_IMAGES = 500;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(["/", "/manifest.webmanifest", "/icon.svg"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keep = new Set([SHELL, ASSETS, IMAGES]);
    for (const k of await caches.keys()) if (!keep.has(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

const MAX_ASSETS = 160; // hashed files from older deploys age out
async function trim(cache, max) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

async function shell(req) {
  const cache = await caches.open(SHELL);
  try {
    const res = await Promise.race([fetch(req), new Promise((_, rej) => setTimeout(() => rej(new Error("slow")), 3000))]);
    if (res.ok) cache.put("/", res.clone());
    return res;
  } catch {
    return (await cache.match("/")) || fetch(req);
  }
}

async function cacheFirst(name, req, cors) {
  const cache = await caches.open(name);
  const hit = await cache.match(req.url);
  if (hit) return hit;
  const res = await fetch(cors ? new Request(req.url, { mode: "cors", credentials: "omit" }) : req);
  if (res.ok && (!cors || res.type === "cors")) {
    await cache.put(req.url, res.clone());
    if (Math.random() < 0.05) trim(cache, cors ? MAX_IMAGES : MAX_ASSETS);
  }
  return res;
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (req.mode === "navigate" && url.origin === self.location.origin) { e.respondWith(shell(req)); return; }
  if (url.origin === self.location.origin && url.pathname.startsWith("/assets/")) { e.respondWith(cacheFirst(ASSETS, req, false)); return; }
  if (url.hostname === "image.tmdb.org") { e.respondWith(cacheFirst(IMAGES, req, true).catch(() => fetch(req))); }
});
