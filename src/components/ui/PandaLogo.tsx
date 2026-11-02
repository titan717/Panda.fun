import React from 'react';
import './panda-logo.css';

interface PandaLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'full' | 'mark' | 'typography';
  className?: string;
  onClick?: () => void;
}

const SIZE_MAP = {
  sm: { width: 96, height: 24 },
  md: { width: 132, height: 40 },
  lg: { width: 170, height: 52 },
  xl: { width: 240, height: 74 },
} as const;

function PandaMark({ size }: { size: number }) {
  return (
    <span className="panda-logo-mark" style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 64 64" width="100%" height="100%" fill="none">
        <circle cx="16" cy="15" r="10" fill="var(--panda-ink)" />
        <circle cx="48" cy="15" r="10" fill="var(--panda-ink)" />
        <rect x="11" y="12" width="42" height="42" rx="20" fill="var(--panda-blush)" />
        <ellipse cx="22" cy="30" rx="8" ry="11" transform="rotate(28 22 30)" fill="var(--panda-ink)" />
        <ellipse cx="42" cy="30" rx="8" ry="11" transform="rotate(-28 42 30)" fill="var(--panda-ink)" />
        <circle cx="24" cy="29" r="2.4" fill="var(--panda-blush)" />
        <circle cx="40" cy="29" r="2.4" fill="var(--panda-blush)" />
        <path d="M29 39c1.8-2.2 4.2-2.2 6 0-1 3.4-5 4.1-6 0Z" fill="var(--panda-ink)" />
        <path d="M32 42v3" stroke="var(--panda-ink)" strokeWidth="2" strokeLinecap="round" />
        <circle cx="18" cy="40" r="3" fill="var(--panda-rose)" opacity=".9" />
        <circle cx="46" cy="40" r="3" fill="var(--panda-rose)" opacity=".9" />
        <path d="M8 50c7-4 13-2 17 3H8Z" fill="var(--panda-leaf)" />
        <path d="M56 50c-7-4-13-2-17 3h17Z" fill="var(--panda-leaf)" />
      </svg>
    </span>
  );
}

export function PandaLogo({ size = 'md', variant = 'full', className = '', onClick }: PandaLogoProps) {
  const dimensions = SIZE_MAP[size];
  if (variant === 'mark') {
    return (
      <span className="panda-logo-inline" style={{ width: dimensions.height, height: dimensions.height }} onClick={onClick}>
        <PandaMark size={dimensions.height} />
      </span>
    );
  }
  if (variant === 'typography') {
    return <span className="panda-wordmark" onClick={onClick} aria-label="Panda.fun">panda<span>.fun</span></span>;
  }
  return (
    <span className="panda-logo-full" onClick={onClick} aria-label="Panda.fun">
      <PandaMark size={dimensions.height} />
      <span className="panda-wordmark">panda<span>.fun</span></span>
    </span>
  );
}

/** Deprecated alias — kept so existing `KinomaLogo` imports keep working during migration. */
export const KinomaLogo = PandaLogo;
