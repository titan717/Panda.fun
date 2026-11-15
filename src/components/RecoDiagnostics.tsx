import type { Scored } from "../lib/reco/engine";
import type { PreferenceModel } from "../lib/reco/model";
import { recoFunnel } from "../lib/reco/metrics";
import { getState } from "../lib/store";

/** Developer-only view of the engine (dev builds, or `localStorage["panda:recodebug"] = "1"`). Never shown to viewers by default. */
export const recoDebug = () => {
  if (import.meta.env.DEV) return true;
  try { return localStorage.getItem("panda:recodebug") === "1"; } catch { return false; }
};

export function RecoDiagnostics({ ranked, model }: { ranked: Scored[]; model: PreferenceModel }) {
  const st = getState();
  const funnel = recoFunnel(st.activeProfileId, st.activeProfileId ? st.data[st.activeProfileId]?.history ?? {} : {});
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const genres = [...model.genres].sort((a, b) => b[1] - a[1]).slice(0, 8);
  return (
    <details className="reco-diag" id="reco-diag">
      <summary>Recommendation diagnostics</summary>
      <p>Signals {model.signals} · movie {model.type.movie.toFixed(2)} · tv {model.type.tv.toFixed(2)} · popularity {model.popularity} · era {model.era}</p>
      <p>Genres: {genres.map(([g, v]) => `${g} ${v.toFixed(2)} (${model.genreWhy.get(g) ?? "-"})`).join(", ") || "none"}</p>
      <p>Seeds: {model.seeds.map((s) => `${s.item.title} (${s.why})`).join(", ") || "none"}</p>
      <p>On this device (impressions are cards ≥ 60 % on screen; starts and completions come from this profile's watch history):</p>
      <table id="reco-diag-funnel">
        <thead><tr><th>Row</th><th>Shown</th><th>Opened</th><th>CTR</th><th>Started</th><th>Start rate</th><th>Completed</th><th>Completion</th></tr></thead>
        <tbody>
          {funnel.length === 0 && <tr><td colSpan={8}>No impressions logged yet</td></tr>}
          {funnel.map((f) => <tr key={f.surface}><td>{f.surface}</td><td>{f.shown}</td><td>{f.opened}</td><td>{pct(f.ctr)}</td><td>{f.started}</td><td>{pct(f.startRate)}</td><td>{f.completed}</td><td>{pct(f.completionRate)}</td></tr>)}
        </tbody>
      </table>
      <table>
        <thead><tr><th>Title</th><th>Score</th><th>genre</th><th>similar</th><th>type</th><th>quality</th><th>pop</th><th>fresh</th><th>lang</th><th>Reason</th></tr></thead>
        <tbody>
          {ranked.slice(0, 25).map((s) => (
            <tr key={s.c.item.id}><td>{s.c.item.title}</td><td>{s.score.toFixed(2)}</td>
              {(["genre", "similar", "type", "quality", "popularity", "freshness", "language"] as const).map((k) => <td key={k}>{s.parts[k].toFixed(2)}</td>)}
              <td>{s.reason?.text ?? "—"}</td></tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
