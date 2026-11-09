/**
 * Icons used only by lazily loaded screens (v1.2.2), kept out of the entry icon map so the first
 * load does not grow (docs/PERF.md). Same 24-unit stroke style as <Icon>.
 */
const PATHS = {
  videoBox: "M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm5 4v6l5-3-5-3Z",
  warning: "M12 4 2.8 19.5h18.4L12 4Zm0 6v4.5m0 2.6h.01",
  signal: "M5 19v-3M10 19v-7M15 19V9M20 19V5",
  pip: "M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm8 7h6v4h-6z",
  sun: "M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm0-5v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M5.6 18.4 7 17m10-10 1.4-1.4",
  eyeOff: "M3 3l18 18M10.6 6.1A9.7 9.7 0 0 1 12 6c5 0 9 6 9 6a16 16 0 0 1-2.8 3.3M6.6 6.6A16 16 0 0 0 3 12s4 6 9 6a9 9 0 0 0 4.4-1.1M9.9 9.9a3 3 0 0 0 4.2 4.2",
  /** Connect Phone (blueprint sidebar): a phone with signal arcs. */
  phone: "M6.5 3h7A1.5 1.5 0 0 1 15 4.5v15a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 5 19.5v-15A1.5 1.5 0 0 1 6.5 3ZM9 17.5h2M18 9a4 4 0 0 1 0 6m2.5-8.5a7.5 7.5 0 0 1 0 11"
} as const;

export function ExtraIcon({ name, className }: { name: keyof typeof PATHS; className?: string }) {
  return (
    <svg className={`icon ${className ?? ""}`} viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" focusable="false"
      fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d={PATHS[name]} />
    </svg>
  );
}
