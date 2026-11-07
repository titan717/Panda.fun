import { ActionButton } from './ActionButton';

interface HeroBannerProps {
  title: string;
  image?: string;
  metadata?: string;
  synopsis?: string;
  onWatch?: () => void;
  onAdd?: () => void;
  className?: string;
}

export function HeroBanner({ title, image, metadata, synopsis, onWatch, onAdd, className = '' }: HeroBannerProps) {
  return (
    <section className={`relative overflow-hidden rounded-[var(--bp-radius-lg)] bg-[var(--bp-surface)] ${className}`} aria-label={title}>
      <div className="relative aspect-[16/10] w-full sm:aspect-[16/7]">
        {image ? <img src={image} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full bg-gradient-to-br from-[#1c2733] to-black" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-transparent" />
      </div>
      <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6">
        <h1 className="text-[var(--bp-text-hero)] font-extrabold leading-tight text-white">{title}</h1>
        {metadata ? <p className="mt-1 text-xs text-[var(--bp-text-secondary)]">{metadata}</p> : null}
        {synopsis ? <p className="mt-2 line-clamp-2 max-w-xl text-sm text-[var(--bp-text-secondary)]">{synopsis}</p> : null}
        <div className="mt-3 flex items-center gap-2">
          <ActionButton onClick={onWatch}>Watch Now</ActionButton>
          <ActionButton variant="secondary" onClick={onAdd}>+</ActionButton>
        </div>
      </div>
    </section>
  );
}

export default HeroBanner;
