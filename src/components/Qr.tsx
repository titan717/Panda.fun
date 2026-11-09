import qrcode from "qrcode-generator";
import { useMemo } from "react";

/** A QR drawn as one SVG path so it stays sharp on 4K TVs (sync code, Connect Phone). */
export function Qr({ text, size = 200, label, className = "sync-qr" }: { text: string; size?: number; label: string; className?: string }) {
  const d = useMemo(() => {
    const q = qrcode(0, "M");
    q.addData(text);
    q.make();
    const n = q.getModuleCount();
    let path = "";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) path += `M${c + 2} ${r + 2}h1v1h-1z`;
    return { path, n: n + 4 };
  }, [text]);
  return (
    <svg className={className} width={size} height={size} viewBox={`0 0 ${d.n} ${d.n}`} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect width={d.n} height={d.n} fill="#fff" />
      <path d={d.path} fill="#000" />
    </svg>
  );
}
