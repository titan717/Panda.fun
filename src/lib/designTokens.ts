/**
 * Kinoma Design System Tokens
 * Phase 1: Foundational Design System & App Shell
 * 
 * Provides centralized tokens for colors, typography, spacing, radius,
 * elevation, and TV focus states across the Kinoma platform.
 */

export const tokens = {
  colors: {
    // Canvas & Surfaces
    background: '#000000',
    backgroundElevated: '#050505',
    surface: '#070707',
    surfaceHover: '#0b0b0b',
    surfaceActive: '#101010',
    card: '#050505',
    cardHover: '#0a0a0a',

    // Borders & Dividers
    borderSubtle: 'rgba(255, 255, 255, 0.05)',
    borderDefault: 'rgba(255, 255, 255, 0.08)',
    borderStrong: 'rgba(255, 255, 255, 0.16)',
    borderFocus: 'rgba(168, 85, 247, 0.6)',

    // Text & Content
    textPrimary: '#f9fafb',
    textSecondary: '#9ca3af',
    textMuted: '#6b7280',
    textInverse: '#08090d',

    // Accent Palette (Artistic & Cinematic Purple/Violet)
    accent: '#9333ea',
    accentHover: '#a855f7',
    accentLight: '#c084fc',
    accentSubtle: 'rgba(147, 51, 234, 0.15)',
    accentGlow: 'rgba(147, 51, 234, 0.35)',

    // Semantic Status
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',

    // Glass & Overlay
    overlayDark: 'rgba(0, 0, 0, 0.88)',
    glassBackground: 'rgba(5, 5, 5, 0.82)',
    glassBorder: 'rgba(255, 255, 255, 0.08)',
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
