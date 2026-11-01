import React, { useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, ExternalLink, Play, RotateCcw } from 'lucide-react';
import { Link } from 'wouter';
import { MOVIE_API_BASE_URL, MOVIE_API_FALLBACK_URL } from '../lib/api';
import { updateSEO } from '../lib/seo';

type Endpoint = {
  method: 'GET';
  path: string;
  description: string;
};

const ENDPOINTS: Endpoint[] = [
  { method: 'GET', path: '/api/v1/health', description: 'Check API and provider health.' },
  { method: 'GET', path: '/api/v1/search?q=Breaking%20Bad', description: 'Search TV content.' },
  { method: 'GET', path: '/api/v1/tv/169', description: 'Get normalized TV metadata.' },
  { method: 'GET', path: '/api/v1/tv/169/seasons', description: 'List seasons.' },
  { method: 'GET', path: '/api/v1/tv/169/season/1', description: 'Get a season and its episodes.' },
  { method: 'GET', path: '/api/v1/tmdb/search/movie?q=Inception', description: 'Search TMDB movies.' },
  { method: 'GET', path: '/api/v1/tmdb/search/tv?q=Breaking%20Bad', description: 'Search TMDB TV.' },
  { method: 'GET', path: '/api/v1/home', description: 'Get the Panda.fun homepage aggregation.' },
  { method: 'GET', path: '/api/v1/movie/27205/play', description: 'Resolve a movie playback source.' },
  { method: 'GET', path: '/api/v1/tv/47199/season/1/episode/1/play', description: 'Resolve All of Us Are Dead S1E1 playback.' },
];

function baseFor(url: string) {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

export function Docs() {
  const [base, setBase] = useState(baseFor(MOVIE_API_BASE_URL));
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [running, setRunning] = useState<string | null>(null);

  React.useEffect(() => {
    updateSEO({
      title: 'API Documentation',
      description: 'Interactive Panda.fun Movie API documentation.',
      type: 'website',
    });
  }, []);

  const activeBase = useMemo(() => baseFor(base.trim() || MOVIE_API_FALLBACK_URL), [base]);

  async function tryEndpoint(endpoint: Endpoint) {
    const key = endpoint.path;
    setRunning(key);
    try {
      const response = await fetch(activeBase + endpoint.path, {
        headers: { Accept: 'application/json' },
      });
      const text = await response.text();
      let formatted = text;
      try { formatted = JSON.stringify(JSON.parse(text), null, 2); } catch {}
      setResponses(prev => ({ ...prev, [key]: response.status + ' ' + response.statusText + '\n\n' + formatted }));
    } catch (error) {
      setResponses(prev => ({ ...prev, [key]: 'Request failed: ' + (error instanceof Error ? error.message : String(error)) }));
    } finally {
      setRunning(null);
    }
  }

  function clear() {
    setResponses({});
  }

  return (
    <div className="min-h-screen bg-[var(--kinoma-bg)] text-white">
      <div className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8">
        <header className="flex flex-col gap-6 border-b border-white/10 pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link href="/home" className="mb-6 inline-flex items-center gap-2 text-sm text-white/55 hover:text-white">
              <ArrowLeft size={15} /> Back to Panda.fun
            </Link>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/40">Developer documentation</p>
            <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-6xl">Panda.fun API</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-white/55">
              Interactive Movie API documentation. Choose an endpoint and run it directly from this page.
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={clear} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-semibold text-white/70 hover:bg-white/[0.08]">
              <RotateCcw size={14} /> Clear
            </button>
            <a href={activeBase + '/openapi.yaml'} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-semibold text-white/70 hover:bg-white/[0.08]">
              OpenAPI <ExternalLink size={14} />
            </a>
          </div>
        </header>

        <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.035] p-5">
          <label className="block text-xs font-bold uppercase tracking-wider text-white/45" htmlFor="api-base">API base URL</label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input id="api-base" value={base} onChange={e => setBase(e.target.value)} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-white/30" />
            <button type="button" onClick={() => setBase(MOVIE_API_FALLBACK_URL)} className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-semibold text-white/65 hover:bg-white/[0.06]">Use Render</button>
          </div>
          <p className="mt-2 text-xs text-white/35">Default: the configured Panda.fun Movie API endpoint. The Render endpoint is available as a fallback while Vercel deployment limits apply.</p>
        </section>

        <section className="mt-8 space-y-3">
          {ENDPOINTS.map(endpoint => {
            const response = responses[endpoint.path];
            return (
              <article key={endpoint.path} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]">
                <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <span className="w-fit rounded-lg border border-white/10 bg-white/[0.05] px-2 py-1 font-mono text-[11px] font-bold text-white/70">{endpoint.method}</span>
                  <code className="min-w-0 flex-1 break-all text-xs text-white/80">{endpoint.path}</code>
                  <button type="button" onClick={() => tryEndpoint(endpoint)} disabled={running === endpoint.path} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-bold text-black disabled:opacity-50">
                    {running === endpoint.path ? <span>Running…</span> : <><Play size={13} /> Try it</>}
                  </button>
                </div>
                <div className="px-4 pb-4 text-xs text-white/40">{endpoint.description}</div>
                {response && (
                  <div className="mx-4 mb-4 flex gap-2 rounded-xl border border-white/10 bg-black/30 p-3">
                    <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-white/55" />
                    <pre className="max-h-96 min-w-0 flex-1 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-white/65">{response}</pre>
                  </div>
                )}
              </article>
            );
          })}
        </section>

        <footer className="mt-10 border-t border-white/10 pt-6 text-xs text-white/35">
          <p>Responses are live requests to the selected API base. Do not enter or store private API keys in this page.</p>
        </footer>
      </div>
    </div>
  );
}
