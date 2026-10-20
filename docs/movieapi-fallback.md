# MovieAPI fallback

Panda.fun uses Render as the primary MovieAPI endpoint and Vercel as the fallback.

- Primary: `https://movieapi-3d0v.onrender.com`
- Fallback: `https://apikinomafallback.vercel.app`
- Health check: `/api/v1/health`

The shared client retries the same request against Vercel when the primary endpoint times out, cannot be reached, is suspended, is rate-limited, or returns a retryable HTTP error. GET caching and request de-duplication remain in the shared client. The API contract and `/api/v1` routes must remain compatible on both deployments.

Configure `VITE_MOVIE_API_FALLBACK_URL=https://apikinomafallback.vercel.app` in the frontend deployment environment when explicitly setting the fallback. The client also has this endpoint as its built-in default.

## Important provider configuration

The Vercel health endpoint was reachable on 2026-10-20 and reported MovieAPI `0.9.0`, Vidy embed playback configured, TVMaze configured, and TMDB **not configured**. A healthy API process does not guarantee that all catalog/search features work. Configure the required TMDB credentials in the Vercel MovieAPI project's server-side environment and verify home, search, details, seasons/episodes, and playback before treating the fallback as fully production-ready.

Do not change the Vidy URL construction or Android TV navigation as part of API failover work.