interface ChipProps {
  children: React.ReactNode;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}

export function Chip({ children, selected = false, onClick, className = '' }: ChipProps) {
  const Component = onClick ? 'button' : 'span';
  return (
    <Component
      onClick={onClick}
      className={`bp-focusable inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        selected
          ? 'border-[var(--bp-accent)] bg-[var(--bp-accent)] text-[var(--bp-accent-contrast)]'
          : 'border-[var(--bp-border)] bg-[var(--bp-surface)] text-[var(--bp-text-secondary)]'
      } ${className}`}
    >
      {children}
    </Component>
  );
}

export default Chip;
