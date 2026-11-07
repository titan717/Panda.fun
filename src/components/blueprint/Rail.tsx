import type { ReactNode } from 'react';
import { SectionHeader } from './SectionHeader';

interface RailProps {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Rail({ title, action, children, className = '' }: RailProps) {
  return (
    <section className={`bp-section ${className}`}>
      <SectionHeader title={title} action={action} />
      <div className="bp-rail mt-3">{children}</div>
    </section>
  );
}

export default Rail;
