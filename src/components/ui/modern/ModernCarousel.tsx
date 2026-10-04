import React, { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ModernCarouselProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  actionText?: string;
  onAction?: () => void;
  className?: string;
}

export function ModernCarousel({ 
  title, 
  subtitle, 
  children, 
  actionText, 
  onAction,
  className = '' 
}: ModernCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 10);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (el) {
      el.addEventListener('scroll', checkScroll, { passive: true });
      window.addEventListener('resize', checkScroll);
      return () => {
        el.removeEventListener('scroll', checkScroll);
        window.removeEventListener('resize', checkScroll);
      };
    }
  }, [children]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { clientWidth } = scrollRef.current;
      const scrollAmount = direction === 'left' ? -clientWidth * 0.75 : clientWidth * 0.75;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <section className={`w-full group/carousel relative my-4 sm:my-6 md:my-8 ${className}`}>
      
      {/* Section Header */}
      <div className="flex items-center justify-between mb-3 sm:mb-4 px-4 sm:px-6 md:px-8 lg:px-10 max-w-[1680px] mx-auto">
        <div>
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white tracking-tight">
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {actionText && (
            <button
              onClick={onAction}
              className="min-h-10 px-2 text-xs font-semibold text-gray-400 hover:text-white transition-colors cursor-pointer mr-2 inline-flex items-center"
            >
              {actionText}
            </button>
          )}

          {/* Desktop Chevron Navigation Controls */}
          <div className="hidden sm:flex items-center gap-1.5">
            <button
              onClick={() => scroll('left')}
              disabled={!canScrollLeft}
              className={`w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white transition-all backdrop-blur-md kinoma-focus ${
                !canScrollLeft ? 'opacity-25 cursor-not-allowed' : 'opacity-80 hover:opacity-100 cursor-pointer'
              }`}
              aria-label="Scroll left"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              onClick={() => scroll('right')}
              disabled={!canScrollRight}
              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white transition-all backdrop-blur-md kinoma-focus ${
                !canScrollRight ? 'opacity-25 cursor-not-allowed' : 'opacity-80 hover:opacity-100 cursor-pointer'
              }`}
              aria-label="Scroll right"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Horizontal Carousel Track with Responsive Card Proportions:
          - Mobile (<640px): ~2.2 - 2.5 cards visible (w-[41vw] to w-[43vw])
          - Tablet (640px - 1024px): 3 to 4 cards visible (sm:w-[28vw] md:w-[22vw])
          - Laptop (1024px - 1440px): 5 cards visible (lg:w-[18%])
          - Desktop & Ultra-wide (1440px+): 5.5 - 6 cards visible (xl:w-[15.3%])
      */}
      <div className="w-full relative">
        <div
          ref={scrollRef}
          className="flex items-start gap-3 sm:gap-4 md:gap-5 overflow-x-auto no-scrollbar scroll-smooth px-4 sm:px-6 md:px-8 lg:px-10 max-w-[1680px] mx-auto py-1"
          style={{ 
            scrollSnapType: 'x mandatory',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}
        >
          {children}
        </div>
      </div>

    </section>
  );
}

/**
 * Standard Responsive Card Slot to guarantee exact card sizing at every breakpoint
 */
export function ModernCarouselSlot({ children }: { children: React.ReactNode; key?: React.Key }) {
  return (
    <div 
      className="shrink-0 w-[42vw] xs:w-[39vw] sm:w-[28vw] md:w-[22vw] lg:w-[18%] xl:w-[15.2%] min-w-[130px] sm:min-w-[155px] max-w-[220px]"
      style={{ scrollSnapAlign: 'start' }}
    >
      {children}
    </div>
  );
}
