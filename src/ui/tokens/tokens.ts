/**
 * HOUSEHOLD FLOW — Typed token map (Phase 08).
 * Mirrors tokens.css. Components reference `token('accent')` etc. so TypeScript
 * guards against typos and downstream tools (Tailwind, SwiftUI export) share one
 * source of truth. Values resolve to CSS custom properties at runtime.
 */

export const semanticColors = [
  'surface', 'surface-sunken', 'surface-raised', 'surface-overlay',
  'content-primary', 'content-muted', 'content-faint', 'content-on-accent',
  'accent', 'accent-strong', 'accent-tint',
  'signal-slip', 'signal-slip-tint',
  'border-hairline', 'border-strong',
  'balance-warm', 'balance-cool',
] as const;
export type SemanticColor = (typeof semanticColors)[number];

export const space = { 1:2, 2:4, 3:8, 4:12, 5:16, 6:24, 7:32, 8:48, 9:64 } as const;
export const radius = { sm:8, md:12, lg:20, sheet:28, full:999 } as const;

export const type = {
  voice: 'var(--font-voice)',
  ui:    'var(--font-ui)',
  num:   'var(--font-num)',
  scale: {
    display: 'var(--text-display)', title: 'var(--text-title)',
    heading: 'var(--text-heading)', body: 'var(--text-body)',
    callout: 'var(--text-callout)', caption: 'var(--text-caption)',
  },
} as const;

export const motion = {
  dur: { instant:80, quick:160, standard:240, settle:320, mode:500 },
  ease: { calm: 'var(--ease-calm)', snappy: 'var(--ease-snappy)' },
} as const;

/** Household Modes reconfigure the semantic layer (Phase 02 §12). */
export const modes = ['normal','recovery','travel','guest','moving','new-arrival','emergency'] as const;
export type Mode = (typeof modes)[number];

/** Resolve a semantic color token to its CSS var reference. */
export const color = (t: SemanticColor) => `var(--${t})`;
