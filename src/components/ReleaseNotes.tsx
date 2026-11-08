/** Minimal Markdown → headed items for release notes (no HTML injection).
 *  "- **Title**: body" bullets render as an item with a bold headline and a body line (v1.1.8). */
export function ReleaseNotes({ text, max = 40 }: { text: string; max?: number }) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).filter((l) => !/^\*\*Full Changelog/i.test(l)).slice(0, max);
  const clean = (l: string) => l.replace(/\*\*/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
  return (
    <div className="upd-notes">
      {lines.map((l, i) => {
        if (/^[-*] /.test(l)) {
          const raw = l.replace(/^[-*] /, "");
          const m = /^\*\*([^*]+)\*\*\s*[:.\u2014-]?\s*(.*)$/.exec(raw);
          if (m) return (
            <div key={i} className="upd-item">
              <span className="upd-dot" aria-hidden="true" />
              <div><p className="upd-item-t">{clean(m[1] ?? "")}</p>{m[2] && <p className="upd-item-b">{cap(clean(m[2]))}</p>}</div>
            </div>
          );
          return <div key={i} className="upd-item"><span className="upd-dot" aria-hidden="true" /><p className="upd-item-b">{clean(raw)}</p></div>;
        }
        return /^#+ /.test(l) ? <p key={i} className="upd-h">{clean(l.replace(/^#+ /, ""))}</p> : <p key={i}>{clean(l)}</p>;
      })}
    </div>
  );
}
