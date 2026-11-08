import { Component, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { Icon, PandaMark } from "./Icon";
import { sizedImage } from "../lib/imageTier";
import type { AvatarKind } from "../lib/store";

/* ---------- Image with graceful fallback (spec 18.5) ---------- */
/** `fallback` (v1.1.8): a second image (e.g. the poster when a title has no backdrop) tried before the text tile. */
export function Img({ src: rawSrc, alt, className, title, eager, sizes, style, fallback }: { src: string | null | undefined; alt: string; className?: string; title?: string; eager?: boolean; sizes?: string; style?: CSSProperties; fallback?: string | null }) {
  const src = sizedImage(rawSrc);
  // State is keyed by URL rather than reset in an effect: a cached image can fire `load` before effects run,
  // and an effect-based reset would then hide an image that is already on screen.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el && src && el.complete && el.naturalWidth > 0) setLoadedSrc(src);
  }, [src]);
  if (!src || failedSrc === src) {
    if (fallback && fallback !== rawSrc) return <Img src={fallback} alt={alt} className={`img--fill ${className ?? ""}`} title={title} eager={eager} style={style} />;
    return (
      <div className={`img-fallback ${className ?? ""}`} role="img" aria-label={alt}>
        <span>{title ?? alt}</span>
      </div>
    );
  }
  return (
    <img ref={ref} src={src} alt={alt} className={`img ${loadedSrc === src ? "is-loaded" : ""} ${className ?? ""}`} loading={eager ? "eager" : "lazy"} decoding="async" sizes={sizes} style={style}
      draggable={false} onLoad={() => setLoadedSrc(src)} onError={() => setFailedSrc(src)} />
  );
}

/** Title logo with text fallback (spec 5.4, 14.3). */
export function TitleArt({ logo, title, className }: { logo?: string | null; title: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [logo]);
  if (!logo || failed) return <h2 className={`title-text ${className ?? ""}`}>{title}</h2>;
  return <img className={`title-logo ${className ?? ""}`} src={logo} alt={title} onError={() => setFailed(true)} draggable={false} />;
}

/* ---------- Skeleton (spec 18.1) ---------- */
export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div className={`skeleton ${className ?? ""}`} style={style} aria-hidden="true" />;
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="spinner-wrap" role="status" aria-live="polite">
      <div className="spinner" />
      {label && <span className="spinner-label">{label}</span>}
    </div>
  );
}

/* ---------- Error / empty states (spec 18.3, 18.4) ---------- */
export function ErrorState({ message, onRetry, compact }: { message?: string; onRetry?: () => void; compact?: boolean }) {
  return (
    <div className={`state ${compact ? "state--compact" : ""}`} role="alert">
      <Icon name="info" size={compact ? 28 : 44} />
      <p className="state-title">Something went wrong</p>
      {message && <p className="state-sub">{message}</p>}
      {onRetry && <button className="btn btn--secondary" data-autofocus onClick={onRetry}><Icon name="refresh" /> Retry</button>}
    </div>
  );
}

export function EmptyState({ icon = "sparkle", title, sub, action }: { icon?: Parameters<typeof Icon>[0]["name"]; title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="state">
      <Icon name={icon} size={44} />
      <p className="state-title">{title}</p>
      {sub && <p className="state-sub">{sub}</p>}
      {action}
    </div>
  );
}

/* ---------- Avatar (spec 3.4) ---------- */
export function Avatar({ kind, name, size, className }: { kind: AvatarKind; name?: string; size?: number | string; className?: string }) {
  const style = size !== undefined ? { width: size, height: size } : undefined;
  return (
    <span className={`avatar avatar--${kind} ${className ?? ""}`} style={style} aria-label={name} role={name ? "img" : undefined}>
      {kind === "kids" && <span className="avatar-kids">KIDS</span>}
      {kind === "smile" && (
        <svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="14" cy="16" r="2.6" fill="#fff" /><circle cx="26" cy="16" r="2.6" fill="#fff" /><path d="M12 24c4.5 5 11.5 5 16 0" stroke="#fff" strokeWidth="2.8" fill="none" strokeLinecap="round" /></svg>
      )}
      {kind === "panda" && <PandaMark size="62%" />}
      {kind === "star" && <Icon name="star" size="50%" />}
      {kind === "wave" && (
        <svg viewBox="0 0 40 40" aria-hidden="true"><path d="M8 22c4-6 8-6 12 0s8 6 12 0" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" /><circle cx="15" cy="14" r="2.4" fill="#fff" /><circle cx="25" cy="14" r="2.4" fill="#fff" /></svg>
      )}
    </span>
  );
}

/* ---------- Toasts ---------- */
type Toast = { id: number; text: string };
let toasts: Toast[] = [];
let tseq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
export function toast(text: string, ms = 2600) {
  const t = { id: ++tseq, text };
  toasts = [...toasts.slice(-2), t];
  emit();
  setTimeout(() => { toasts = toasts.filter((x) => x.id !== t.id); emit(); }, ms);
}
export function Toasts() {
  const list = useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => toasts);
  return (
    <div className="toasts" aria-live="polite">
      {list.map((t) => <div key={t.id} className="toast">{t.text}</div>)}
    </div>
  );
}

/* ---------- Error boundary ---------- */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidUpdate(prev: { resetKey?: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }
  render() {
    if (this.state.error) {
      return (
        <div className="boundary">
          <ErrorState message="This screen hit a problem. Retry, or go back and try again." onRetry={() => this.setState({ error: null })} />
        </div>
      );
    }
    return this.props.children;
  }
}

export function OfflineBanner() {
  return <div className="offline-banner" role="status">You're offline. Showing saved content.</div>;
}
