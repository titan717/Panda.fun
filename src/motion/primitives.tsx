import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { m, useReducedMotion } from 'motion/react';
import { getMotionOffset, motionDurations, motionEasings, motionSprings } from './tokens';
import { useMotionPreference } from './useMotionPreference';

const MotionPreferenceContext = createContext<'full' | 'reduced' | 'minimal'>('full');

export function MotionPreferenceProvider({ children }: { children: React.ReactNode }) {
  const preference = useMotionPreference();
  useEffect(() => {
    document.documentElement.dataset.motionPreference = preference;
    return () => { delete document.documentElement.dataset.motionPreference; };
  }, [preference]);
  return <MotionPreferenceContext.Provider value={preference}>{children}</MotionPreferenceContext.Provider>;
}

export function Pressable({
  children, className, onClick, haptic = false, disabled, ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { haptic?: boolean }) {
  const preference = useContext(MotionPreferenceContext);
  const reduce = useReducedMotion();
  const canMove = preference === 'full' && !reduce;
  const handleClick: React.MouseEventHandler<HTMLButtonElement> = event => {
    if (haptic && typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(8);
    onClick?.(event);
  };
  return (
    <m.button
      {...props}
      type={props.type || 'button'}
      disabled={disabled}
      onClick={handleClick}
      whileTap={canMove ? { scale: 0.96, transition: motionSprings.snappy } : undefined}
      whileHover={canMove ? { scale: 1.015, transition: { duration: motionDurations.fast } } : undefined}
      className={className}
    >
      {children}
    </m.button>
  );
}

export function Reveal({ children, className, delay = 0, once = true, style }: {
  children: React.ReactNode; className?: string; delay?: number; once?: boolean; style?: React.CSSProperties;
}) {
  const preference = useContext(MotionPreferenceContext);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setVisible(true);
        if (once) observer.disconnect();
      } else if (!once) setVisible(false);
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.01 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [once]);
  const reduced = preference !== 'full';
  return (
    <m.div
      ref={ref}
      className={className}
      style={style}
      initial={false}
      animate={visible ? { opacity: 1, y: 0 } : { opacity: 0, y: getMotionOffset(preference, 12) }}
      transition={{ duration: reduced ? motionDurations.fast : motionDurations.base, delay: reduced ? 0 : delay, ease: motionEasings.emphasized }}
    >
      {children}
    </m.div>
  );
}

export function Stagger({ children, className, interval = 0.04 }: {
  children: React.ReactNode; className?: string; interval?: number;
}) {
  const preference = useContext(MotionPreferenceContext);
  return (
    <div className={className}>
      {React.Children.toArray(children).map((child, index) => (
        <Reveal key={index} delay={preference === 'full' ? index * interval : 0}>{child}</Reveal>
      ))}
    </div>
  );
}

export function Shimmer({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`panda-motion-shimmer ${className}`} />;
}

export function AnimatedCheck({ checked, size = 20, className }: {
  checked: boolean; size?: number; className?: string;
}) {
  const preference = useContext(MotionPreferenceContext);
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <m.path d="m5 12.5 4.2 4.2L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
        initial={false} animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
        transition={{ duration: preference === 'full' ? motionDurations.base : 0.01, ease: motionEasings.emphasized }} />
    </svg>
  );
}

export function ProgressRing({ value, size = 40, strokeWidth = 3, className }: {
  value: number; size?: number; strokeWidth?: number; className?: string;
}) {
  const preference = useContext(MotionPreferenceContext);
  const progress = Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={className} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" opacity=".18" strokeWidth={strokeWidth} />
      <m.circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`} strokeDasharray={circumference}
        initial={false} animate={{ strokeDashoffset: circumference * (1 - progress / 100) }}
        transition={{ duration: preference === 'full' ? motionDurations.slow : 0.01, ease: motionEasings.standard }} />
    </svg>
  );
}
