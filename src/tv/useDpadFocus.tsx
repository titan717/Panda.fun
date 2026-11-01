import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

type FocusableMeta = { id: string; node: HTMLElement; route: string };
type DpadContextValue = {
  register: (meta: FocusableMeta) => () => void;
  focusId: (id: string) => void;
  restoreFocus: (route: string) => void;
  focusedId: string | null;
};

const DpadContext = createContext<DpadContextValue | null>(null);

export function DpadFocusProvider({ children, route }: { children: React.ReactNode; route: string }) {
  const registry = useRef(new Map<string, FocusableMeta>());
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const lastFocusedByRoute = useRef(new Map<string, string>());

  const register = useCallback((meta: FocusableMeta) => {
    registry.current.set(meta.id, meta);
    return () => { registry.current.delete(meta.id); };
  }, []);

  const focusId = useCallback((id: string) => {
    const meta = registry.current.get(id);
    if (!meta) return;
    meta.node.focus({ preventScroll: true });
    setFocusedId(id);
    lastFocusedByRoute.current.set(route, id);
  }, [route]);

  const restoreFocus = useCallback((route: string) => {
    const last = lastFocusedByRoute.current.get(route);
    if (last && registry.current.has(last)) focusId(last);
  }, [focusId, route]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const dirs: Record<string, [number, number]> = {
        ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
      };
      const dir = dirs[event.key];
      if (!dir || !focusedId) return;
      const current = registry.current.get(focusedId);
      if (!current) return;
      const cur = current.node.getBoundingClientRect();
      const cx = cur.left + cur.width / 2;
      const cy = cur.top + cur.height / 2;
      let best: FocusableMeta | null = null;
      let bestScore = Infinity;
      registry.current.forEach(meta => {
        if (meta.id === focusedId) return;
        const r = meta.node.getBoundingClientRect();
        const mx = r.left + r.width / 2;
        const my = r.top + r.height / 2;
        const dx = mx - cx, dy = my - cy;
        const dot = dx * dir[0] + dy * dir[1];
        if (dot <= 0) return;
        const perp = Math.abs(dx * dir[1] + dy * dir[0]);
        const score = dot + perp * 2;
        if (score < bestScore) { bestScore = score; best = meta; }
      });
      if (best) {
        event.preventDefault();
        focusId((best as FocusableMeta).id);
        (best as FocusableMeta).node.scrollIntoView({
          block: 'nearest', inline: 'nearest',
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focusedId, focusId]);

  useEffect(() => { restoreFocus(route); }, [route, restoreFocus]);

  return <DpadContext.Provider value={{ register, focusId, restoreFocus, focusedId }}>{children}</DpadContext.Provider>;
}

export function useDpadFocus(id: string) {
  const ctx = useContext(DpadContext);
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!ctx || !ref.current) return;
    const meta = { id, node: ref.current, route: window.location.pathname };
    return ctx.register(meta);
  }, [id, ctx]);
  return ref;
}
