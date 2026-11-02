export const pandaTheme = {
  color: {
    bg: 'var(--panda-bg)',
    surface: 'var(--panda-surface)',
    text: 'var(--panda-text)',
    muted: 'var(--panda-muted)',
    accent: 'var(--panda-accent)',
    accentLight: 'var(--panda-accent-light)',
    amber: 'var(--panda-amber)',
  },
  space: ['4px','8px','12px','16px','24px','32px','48px','64px'],
  radius: { sm: '8px', md: '12px', lg: '16px', xl: '20px', pill: '999px' },
  shadow: {
    1: '0 2px 8px rgba(0,0,0,.18)',
    2: '0 8px 24px rgba(0,0,0,.28)',
    3: '0 16px 40px rgba(0,0,0,.36)',
  },
  duration: { fast: 150, base: 220, slow: 360 },
  zIndex: { content: 1, nav: 20, modal: 60, toast: 80 },
} as const;

export type PandaTheme = typeof pandaTheme;
