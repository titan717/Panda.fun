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
    <span className={`panda-logo-mark ${className}`} style={{ width: size, height: size }}>
      <img src="/icon.svg" alt="" aria-hidden="true" width={size} height={size} />
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
