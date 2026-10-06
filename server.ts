import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

const MOVIE_API = "https://movieapi-3d0v.onrender.com";
const MOVIE_API_FALLBACK = "";
const SITE_NAME = "Panda.fun";
const SITE_DESCRIPTION = "Watch anime, movies and TV series on Panda.fun. Discover trending titles, new releases, popular shows and stories worth watching.";

function htmlEscape(value: unknown) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" } as Record<string, string>)[char] || char);
}

function unwrapApiPayload(payload: any) {
  return payload?.success === true && payload.data ? payload.data : payload;
}

function slugifyTitle(title: string) {
  return String(title || "").normalize("NFKD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90) || "title";
}

function mediaRouteId(raw: string) {
  const id = decodeURIComponent(raw || "");
  const tmdb = id.match(/^tmdb_(movie|tv)_(\d+)$/);
  if (tmdb) return { id, type: tmdb[1] as "movie" | "tv", provider: "tmdb", providerId: Number(tmdb[2]) };
  const tvmaze = id.match(/^kinoma_tvmaze_(\d+)$/);
  if (tvmaze) return { id, type: "tv" as const, provider: "tvmaze", providerId: Number(tvmaze[1]) };
  return null;
}

async function fetchSeoMedia(rawId: string) {
  const media = mediaRouteId(rawId);
  try {
    if (media) {
      const endpoint = media.provider === "tvmaze"
        ? "/api/v1/tv/" + media.providerId
        : "/api/v1/tmdb/" + (media.type === "movie" ? "movie/" : "tv/") + media.providerId;
      const response = await fetch(MOVIE_API + endpoint, { headers: { Accept: "application/json" } });
      if (!response.ok) return null;
      return unwrapApiPayload(await response.json());
    }
    const query = decodeURIComponent(rawId).replace(/-/g, " ");
    const [movieResponse, tvResponse] = await Promise.all([
      fetch(MOVIE_API + "/api/v1/tmdb/search/movie?q=" + encodeURIComponent(query) + "&page=1", { headers: { Accept: "application/json" } }),
      fetch(MOVIE_API + "/api/v1/tmdb/search/tv?q=" + encodeURIComponent(query) + "&page=1", { headers: { Accept: "application/json" } })
    ]);
    const movie = movieResponse.ok ? unwrapApiPayload(await movieResponse.json()) : {};
    const tv = tvResponse.ok ? unwrapApiPayload(await tvResponse.json()) : {};
    const results = [...(movie?.results || []), ...(tv?.results || [])];
    return results.find((item: any) => slugifyTitle(item.title || item.name || "") === rawId) || results[0] || null;
  } catch {
    return null;
  }
}

function seoTitle(data: any, fallback: string) {
  return typeof data?.title === "string" ? data.title : data?.title?.english || data?.title?.romaji || data?.title?.native || data?.name || fallback;
}

function seoDescription(data: any, title: string) {
  const overview = typeof data?.overview === "string" ? data.overview : typeof data?.description === "string" ? data.description : "";
  const clean = overview.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  return (clean || "Watch " + title + " on Panda.fun. Discover details, episodes, recommendations and more.").slice(0, 160);
}

async function renderSeoHtml(distPath: string, req: express.Request) {
  const html = await fs.promises.readFile(path.join(distPath, "index.html"), "utf8");
  const route = req.path;
  if (!route.startsWith("/details/") && !route.startsWith("/watch/")) return html;
  const rawRouteId = route.slice(route.startsWith("/details/") ? 9 : 7).split("/")[0];
  const rawId = route.startsWith("/watch/") ? rawRouteId.split("$season$")[0] : rawRouteId;
  const data = await fetchSeoMedia(rawId);
  if (!data) return html;
  const origin = req.protocol + "://" + req.get("host");
  const title = seoTitle(data, decodeURIComponent(rawId));
  const description = seoDescription(data, title);
  const image = data?.poster || data?.image || data?.backdrop || data?.cover || origin + "/icon.svg";
  const absoluteImage = image.startsWith("http") ? image : origin + (image.startsWith("/") ? image : "/" + image);
  const isMovie = data?.type === "movie" || data?.contentType === "movie" || req.query.type === "movie";
  const pageTitle = route.startsWith("/watch/") ? "Watch " + title + " — " + SITE_NAME : title + " — " + SITE_NAME;
  const canonical = origin + route;
  const schema = {
    "@context": "https://schema.org",
    "@type": isMovie ? "Movie" : "TVSeries",
    name: title,
    description,
    image: [absoluteImage],
    url: canonical,
    genre: Array.isArray(data?.genres) ? data.genres : undefined,
    datePublished: data?.releaseDate || undefined,
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: origin }
  };
  const tags = [
    "<title>" + htmlEscape(pageTitle) + "</title>",
    "<meta name=\"description\" content=\"" + htmlEscape(description) + "\">",
    "<meta name=\"robots\" content=\"index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1\">",
    "<link rel=\"canonical\" href=\"" + htmlEscape(canonical) + "\">",
    "<meta property=\"og:title\" content=\"" + htmlEscape(pageTitle) + "\">",
    "<meta property=\"og:description\" content=\"" + htmlEscape(description) + "\">",
    "<meta property=\"og:url\" content=\"" + htmlEscape(canonical) + "\">",
    "<meta property=\"og:type\" content=\"" + (isMovie ? "video.movie" : "video.tv_show") + "\">",
    "<meta property=\"og:image\" content=\"" + htmlEscape(absoluteImage) + "\">",
    "<meta property=\"og:site_name\" content=\"Panda.fun\">",
    "<meta name=\"twitter:card\" content=\"summary_large_image\">",
    "<meta name=\"twitter:title\" content=\"" + htmlEscape(pageTitle) + "\">",
    "<meta name=\"twitter:description\" content=\"" + htmlEscape(description) + "\">",
    "<meta name=\"twitter:image\" content=\"" + htmlEscape(absoluteImage) + "\">",
    "<script id=\"panda-ssr-schema\" type=\"application/ld+json\">" + JSON.stringify(schema).replace(/</g, "\\u003c") + "</script>"
  ].join("\n");
  const cleaned = html
    .replace(/<title>[\s\S]*?<\/title>/i, "")
    .replace(/<meta\s+name="description"[^>]*>/i, "")
    .replace(/<meta\s+name="robots"[^>]*>/i, "")
    .replace(/<link\s+rel="canonical"[^>]*>/i, "")
    .replace(/<meta\s+property="og:[^"]+"[^>]*>/gi, "")
    .replace(/<meta\s+name="twitter:[^"]+"[^>]*>/gi, "");
  return cleaned.replace("</head>", tags + "\n</head>");
}

async function buildSitemap(origin: string) {
  const urls = new Set<string>([origin + "/", origin + "/browse", origin + "/home", origin + "/whats-new"]);
  const endpoints = ["/api/v1/trending?window=week", "/api/v1/popular/movies", "/api/v1/popular/tv"];
  const batches = await Promise.all(endpoints.map(async (endpoint) => {
    try {
      const response = await fetch(MOVIE_API + endpoint, { headers: { Accept: "application/json" } });
      if (!response.ok) return [];
      const data = unwrapApiPayload(await response.json());
      return Array.isArray(data?.results) ? data.results : [];
    } catch {
      return [];
    }
  }));
  for (const item of batches.flat()) {
    if (typeof item?.id === "string" && item.id.startsWith("kinoma_")) urls.add(origin + "/details/" + encodeURIComponent(slugifyTitle(item.title || item.name || item.original_title || item.original_name || item.id)) + "?type=" + (item.type === "movie" ? "movie" : "series"));
  }
  const body = Array.from(urls).map((url) => "  <url><loc>" + htmlEscape(url) + "</loc></url>").join("\n");
  return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n" + body + "\n</urlset>";
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  async function proxyHandler(targetPath: string, req: express.Request, res: express.Response) {
    try {
      const queryString = new URLSearchParams(req.query as any).toString();
      const targets = [MOVIE_API, MOVIE_API_FALLBACK].filter(Boolean).filter((value, index, all) => all.indexOf(value) === index);
      let lastError: unknown = null;
      for (let index = 0; index < targets.length; index += 1) {
        try {
          const url = `${targets[index]}${targetPath}${queryString ? '?' + queryString : ''}`;
          const r = await fetch(url);
          const data = await r.json();
          if (r.ok || (r.status < 500 && r.status !== 429) || index === targets.length - 1) return res.status(r.status).json(data);
        } catch (error) {
          lastError = error;
          if (index === targets.length - 1) throw error;
        }
      }
      throw lastError || new Error('MovieApi unavailable.');
    } catch (e: any) {
      res.status(503).json({ error: e.message });
    }
  }

  app.get("/robots.txt", (req, res) => {
    const origin = req.protocol + "://" + req.get("host");
    res.type("text/plain").send("User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /settings\nDisallow: /profile\nDisallow: /library\nSitemap: " + origin + "/sitemap.xml\n");
  });

  app.get("/sitemap.xml", async (req, res) => {
    const origin = req.protocol + "://" + req.get("host");
    try {
      res.type("application/xml").send(await buildSitemap(origin));
    } catch {
      res.status(503).type("application/xml").send("<?xml version=\"1.0\" encoding=\"UTF-8\"?><urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\"></urlset>");
    }
  });

  app.get(['/api/health', '/health'], (req, res) => proxyHandler('/api/v1/health', req, res));
  app.get(['/api/search', '/api/anime/search', '/search'], (req, res) => proxyHandler('/api/v1/search', req, res));
  app.get(['/api/search/:query', '/api/anime/search/:query'], (req, res) => {
    req.query.q = req.params.query;
    proxyHandler('/api/v1/search', req, res);
  });
  app.get(['/api/trending', '/api/anime/trending', '/trending'], (req, res) => proxyHandler('/api/v1/trending', req, res));
  app.get(['/api/popular', '/api/anime/popular', '/popular'], (req, res) => proxyHandler('/api/v1/popular/tv', req, res));
  app.get(['/api/info/:id', '/info/:id'], (req, res) => proxyHandler(`/api/v1/tv/${req.params.id}`, req, res));
  app.get(['/api/episodes/:id', '/episodes/:id'], (req, res) => proxyHandler(`/api/v1/tv/${req.params.id}/episodes`, req, res));
  app.get(['/api/servers/:id/:ep', '/servers/:id/:ep'], (req, res) => proxyHandler(`/api/v1/tv/${req.params.id}/season/1/episode/${req.params.ep}/sources`, req, res));
  app.get(['/api/stream/:id/:ep', '/stream/:id/:ep'], (req, res) => proxyHandler(`/api/v1/tv/${req.params.id}/season/1/episode/${req.params.ep}/play`, req, res));
  app.get(['/api/schedule', '/schedule'], (req, res) => proxyHandler('/api/v1/airing/today', req, res));

  app.get(['/tv/update.json', '/update/latest.json'], (req, res) => {
    const latestJsonPath = path.join(process.cwd(), 'update', 'latest.json');
    if (fs.existsSync(latestJsonPath)) {
      res.setHeader('Content-Type', 'application/json');
      return res.sendFile(latestJsonPath);
    }
    res.json({
      versionCode: 1,
      versionName: '1.0.0',
      apkUrl: 'https://github.com/titan717/Panda.fun/releases/latest/download/Panda.fun.apk',
      releaseNotes: 'Initial release of Panda.fun Native Android TV App.',
      mandatory: false,
      sha256: 'PENDING'
    });
  });

  app.use('/downloads', express.static(path.join(process.cwd(), 'public', 'downloads')));

  app.get('/downloads/Panda.fun.apk', async (req, res) => {
    const filePath = path.join(process.cwd(), 'public', 'downloads', 'Panda.fun.apk');
    if (fs.existsSync(filePath)) {
      return res.download(filePath, 'Panda.fun.apk', {
        headers: {
          'Content-Type': 'application/vnd.android.package-archive',
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
        }
      }, (err) => {
        if (err && !res.headersSent) res.status(404).send('APK file not found');
      });
    }
    res.redirect('https://github.com/titan717/Panda.fun/releases/latest/download/Panda.fun.apk');
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      renderSeoHtml(distPath, req).then(html => res.type("html").send(html)).catch(() => res.sendFile(path.join(distPath, "index.html")));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
