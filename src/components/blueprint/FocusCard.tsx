import type { HTMLAttributes, ReactNode } from 'react';

interface FocusCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function FocusCard({ children, className = '', ...props }: FocusCardProps) {
  return (
    <div tabIndex={0} {...props} className={`bp-focusable bp-card ${className}`}>
      {children}
    </div>
  );
}

export default FocusCard;
