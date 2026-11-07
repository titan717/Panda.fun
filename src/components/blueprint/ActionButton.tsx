import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  icon?: ReactNode;
}

export function ActionButton({ children, variant = 'primary', icon, className = '', ...props }: ActionButtonProps) {
  const styles = {
    primary: 'bg-[var(--bp-accent)] text-[var(--bp-accent-contrast)] hover:bg-[var(--bp-accent-hover)]',
    secondary: 'border border-[var(--bp-border-strong)] bg-white/10 text-white hover:bg-white/15',
    ghost: 'text-[var(--bp-text-secondary)] hover:text-white',
  }[variant];

  return (
    <button
      type="button"
      {...props}
      className={`bp-focusable inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors ${styles} ${className}`}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}

export default ActionButton;
