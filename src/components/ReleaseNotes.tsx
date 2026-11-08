/** Minimal Markdown → paragraphs/bullets for release notes (no HTML injection). */
export function ReleaseNotes({ text, max = 40 }: { text: string; max?: number }) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, max);
  const clean = (l: string) => l.replace(/\*\*/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  return (
    <div className="upd-notes">
      {lines.map((l, i) => /^[-*] /.test(l)
        ? <p key={i} className="upd-bullet">• {clean(l.replace(/^[-*] /, ""))}</p>
        : /^#+ /.test(l) ? <p key={i} className="upd-h">{clean(l.replace(/^#+ /, ""))}</p> : <p key={i}>{clean(l)}</p>)}
    </div>
  );
}
