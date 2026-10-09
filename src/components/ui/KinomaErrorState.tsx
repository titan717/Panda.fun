import React from 'react';
import { Link } from 'wouter';
import { RefreshCw, WifiOff, LifeBuoy } from 'lucide-react';
import { Button } from './Button';

interface KinomaErrorStateProps {
  onRetry?: () => void;
  message?: string;
  compact?: boolean;
}

export function KinomaErrorState({
  onRetry,
  message = "Panda.fun couldn't load this content.",
  compact = false
}: KinomaErrorStateProps) {
  if (compact) {
    return (
      <div className="w-full py-5 px-4 rounded-xl bg-[#080808] border border-white/10 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <WifiOff className="w-4 h-4 text-rose-400 shrink-0" aria-hidden="true" />
          <span className="text-sm font-medium text-gray-300">{message}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {onRetry && <Button size="sm" variant="primary" onClick={onRetry} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>Retry</Button>}
          <Link href="/contact" className="text-xs font-bold text-rose-300 hover:text-white">Support</Link>
        </div>
      </div>
    );
  }

  return (
    <section className="w-full min-h-[320px] flex flex-col items-start justify-center p-6 sm:p-8 bg-[#000] border-y border-white/10 my-6" role="alert">
      <div className="w-11 h-11 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-300 mb-5">
        <WifiOff className="w-5 h-5" aria-hidden="true" />
      </div>
      <span className="text-[10px] tracking-[.16em] uppercase font-extrabold text-rose-300">What went wrong</span>
      <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight mt-2">{message}</h3>
      <p className="text-sm text-gray-400 max-w-xl mt-3 leading-relaxed">
        The catalog or playback service may be temporarily unavailable, or your connection may have been interrupted. Check your connection and reload this section. If the problem keeps happening, send support the page and error details.
      </p>
      <div className="flex flex-wrap items-center gap-3 mt-6">
        {onRetry && <Button size="md" variant="primary" onClick={onRetry} leftIcon={<RefreshCw className="w-4 h-4" />}>Retry</Button>}
        <Link href="/contact" className="inline-flex items-center gap-2 min-h-10 rounded-full border border-white/15 px-4 text-sm font-bold text-white hover:bg-white/5">
          <LifeBuoy size={15} aria-hidden="true" /> Contact support
        </Link>
      </div>
    </section>
  );
}
