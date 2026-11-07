import { FocusCard } from './FocusCard';
import { ProgressBar } from './ProgressBar';

interface MediaCardProps {
  title: string;
  image?: string;
  subtitle?: string;
  progress?: number;
  badge?: string;
  onClick?: () => void;
  className?: string;
}

export function MediaCard({ title, image, subtitle, progress, badge, onClick, className = '' }: MediaCardProps) {
  return (
    <FocusCard onClick={onClick} className={`w-[148px] sm:w-[168px] ${className}`} aria-label={title}>
      <div className="relative aspect-[2/3] w-full bg-[var(--bp-surface-hover)]">
        {image ? (
          <img src={image} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center px-3 text-center text-xs text-[var(--bp-text-muted)]">
            {title}
          </div>
        )}
        {badge ? (
          <span className="absolute left-2 top-2 rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
            {badge}
          </span>
        ) : null}
        {typeof progress === 'number' ? <ProgressBar value={progress} /> : null}
      </div>
      <div className="p-2">
        <p className="line-clamp-1 text-sm font-medium text-white">{title}</p>
        {subtitle ? <p className="mt-0.5 line-clamp-1 text-xs text-[var(--bp-text-muted)]">{subtitle}</p> : null}
      </div>
    </FocusCard>
  );
}

export default MediaCard;
