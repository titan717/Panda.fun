import React from 'react';

export function PandaBrand({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`panda-brand${compact ? ' panda-brand--compact' : ''}`} aria-label="panda.fun">
      <svg className="panda-brand__mark" viewBox="0 0 56 48" role="img" aria-hidden="true">
        <defs><filter id="panda-eye-glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="2.4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
        <ellipse cx="12" cy="12" rx="10" ry="11" fill="#f4f0ed"/><ellipse cx="44" cy="12" rx="10" ry="11" fill="#f4f0ed"/>
        <path d="M7 23C7 10 16 3 28 3s21 7 21 20v5c0 12-9 18-21 18S7 40 7 28z" fill="#f4f0ed"/>
        <ellipse cx="19" cy="23" rx="8" ry="10" fill="#171416" transform="rotate(22 19 23)"/><ellipse cx="37" cy="23" rx="8" ry="10" fill="#171416" transform="rotate(-22 37 23)"/>
        <ellipse cx="19" cy="23" rx="3.4" ry="4.2" fill="#ff2e63" filter="url(#panda-eye-glow)"/><ellipse cx="37" cy="23" rx="3.4" ry="4.2" fill="#ff2e63" filter="url(#panda-eye-glow)"/>
        <path d="M24 33q4-4 8 0q-1 5-4 5t-4-5" fill="#171416"/><path d="M28 38q-4 5-8 1m8-1q4 5 8 1" fill="none" stroke="#171416" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
      {!compact && <span className="panda-brand__word">panda<span>.fun</span></span>}
    </span>
  );
}
