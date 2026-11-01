/**
 * Panda.fun Design System Tokens
 * Phase 1: Foundational Design System & App Shell
 * 
 * Provides centralized tokens for colors, typography, spacing, radius,
 * elevation, and TV focus states across the Panda.fun app.
 */

export const tokens = {
  colors: {
    // Canvas & Surfaces
    background: 'var(--color-background)',
    backgroundElevated: 'var(--color-background-elevated)',
    surface: 'var(--color-surface)',
    surfaceHover: 'var(--color-surface-hover)',
    surfaceActive: 'var(--color-card-hover)',
    card: 'var(--color-card)',
    cardHover: 'var(--color-card-hover)',

    // Borders & Dividers
    borderSubtle: 'var(--color-border-subtle)',
    borderDefault: 'var(--color-border-default)',
    borderStrong: 'var(--color-border-strong)',
    borderFocus: 'var(--color-accent)',

    // Text & Content
    textPrimary: 'var(--color-foreground)',
    textSecondary: 'var(--color-muted)',
    textMuted: 'var(--color-muted-foreground)',
    textInverse: 'var(--color-background)',

    // Panda accent palette (CSS custom properties are the source of truth)
    accent: 'var(--color-accent)',
    accentHover: 'var(--color-accent-hover)',
    accentLight: 'var(--color-accent-light)',
    accentSubtle: 'rgba(184, 77, 65, 0.15)',
    accentGlow: 'rgba(184, 77, 65, 0.35)',

    // Semantic Status
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: 'var(--color-blue)',

    // Glass & Overlay
    overlayDark: 'rgba(0, 0, 0, 0.88)',
    glassBackground: 'rgba(5, 5, 5, 0.82)',
    glassBorder: 'var(--color-border-default)',
  },

  radius: {
    xs: '6px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '20px',
    '2xl': '24px',
    full: '9999px',
  },

  shadows: {
    sm: '0 2px 8px rgba(0, 0, 0, 0.35)',
    md: '0 8px 24px rgba(0, 0, 0, 0.55)',
    lg: '0 16px 48px rgba(0, 0, 0, 0.75)',
    cardHover: '0 12px 32px rgba(0, 0, 0, 0.65)',
    tvFocus: '0 12px 36px rgba(0, 0, 0, 0.85), 0 0 24px rgba(255, 255, 255, 0.35)',
  },

  typography: {
    fontSans: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
    fontDisplay: "'Outfit', 'Plus Jakarta Sans', sans-serif",
    
    // Scale classes
    display: 'text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight',
    pageTitle: 'text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight',
    sectionTitle: 'text-lg sm:text-xl md:text-2xl font-bold tracking-tight',
    cardTitle: 'text-xs sm:text-sm font-semibold leading-snug',
    body: 'text-sm sm:text-base leading-relaxed text-gray-300',
    metadata: 'text-xs text-gray-400 font-medium',
    caption: 'text-[11px] text-gray-500 font-medium',
  },

  transitions: {
    fast: '150ms cubic-bezier(0.16, 1, 0.3, 1)',
    normal: '250ms cubic-bezier(0.16, 1, 0.3, 1)',
    slow: '400ms cubic-bezier(0.16, 1, 0.3, 1)',
  }
} as const;

export type DesignTokens = typeof tokens;
