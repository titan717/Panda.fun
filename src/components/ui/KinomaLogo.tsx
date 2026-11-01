import React from 'react';

interface KinomaLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'full' | 'mark' | 'typography';
  className?: string;
  onClick?: () => void;
}

const SIZE_MAP = {
  sm: { width: 96, height: 30 },
  md: { width: 132, height: 40 },
  lg: { width: 170, height: 52 },
  xl: { width: 240, height: 74 },
} as const;

function PandaMark({ size, className = '' }: { size: number; className?: string }) {
  return (
    <span className={`panda-logo-mark ${className}`} style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 64 64" width="100%" height="100%" fill="none">
        <ellipse cx="16" cy="15" rx="10" ry="12" transform="rotate(-24 16 15)" fill="#171514" />
        <ellipse cx="48" cy="15" rx="10" ry="12" transform="rotate(24 48 15)" fill="#171514" />
        <path d="M32 8C18 8 8 20 8 35c0 13 10 22 24 22s24-9 24-22C56 20 46 8 32 8Z" fill="#F6F2EE" />
        <ellipse cx="23" cy="31" rx="7" ry="9" transform="rotate(24 23 31)" fill="#171514" />
        <ellipse cx="41" cy="31" rx="7" ry="9" transform="rotate(-24 41 31)" fill="#171514" />
        <ellipse cx="23" cy="31" rx="2.1" ry="2.8" fill="#B84D41" />
        <ellipse cx="41" cy="31" rx="2.1" ry="2.8" fill="#B84D41" />
        <path d="M28.5 41c1.2-2.2 5.8-2.2 7 0 0 2.8-1.6 4.5-3.5 4.5s-3.5-1.7-3.5-4.5Z" fill="#171514" />
        <path d="M32 45.5v3m0 0c-2.8 2.5-5.2 2.5-7.5.6m7.5-.6c2.8 2.5 5.2 2.5 7.5.6" stroke="#171514" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export function KinomaLogo({ size = 'md', variant = 'full', className = '', onClick }: KinomaLogoProps) {
  const dimensions = SIZE_MAP[size];

  if (variant === 'mark') {
    return (
      <span className={`inline-flex shrink-0 items-center justify-center select-none ${className}`} style={{ width: dimensions.height, height: dimensions.height }} onClick={onClick}>
        <PandaMark size={dimensions.height} />
      </span>
    );
  }

  if (variant === 'typography') {
    return (
      <span className={`panda-wordmark inline-flex shrink-0 items-center select-none ${className}`} onClick={onClick} aria-label="Panda.fun">
        panda<span>.fun</span>
      </span>
    );
  }

  return (
    <span className={`panda-wordmark-wrap inline-flex shrink-0 items-center select-none ${className}`} onClick={onClick} aria-label="Panda.fun">
      <PandaMark size={dimensions.height} />
      <span className="panda-wordmark">panda<span>.fun</span></span>
    </span>
  );
}
