import React from 'react';
import { useLocation } from 'wouter';
import { DpadFocusProvider } from './useDpadFocus';
import { TvTopNav } from './TvTopNav';
import { useIsTv } from './useIsTv';
import './tv.css';

export function TvAppShell({ children }: { children: React.ReactNode }) {
  const isTv = useIsTv();
  const [location] = useLocation();
  if (!isTv) return <>{children}</>;
  const route = location.split('?')[0];
  return (
    <DpadFocusProvider route={route}>
      <div className="tv-shell">
        <TvTopNav />
        <main className="tv-main" id="tv-main-content">{children}</main>
      </div>
    </DpadFocusProvider>
  );
}
