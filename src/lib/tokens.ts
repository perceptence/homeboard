/**
 * THE TOKENS — one source, two consumers.
 *
 * `tailwind.config.ts` imports this module to build the utility classes the app
 * is written in, and the case-study page imports the SAME object to render its
 * specimens. That's the whole point of the file existing: a swatch on the
 * system page cannot drift from the colour the product actually ships, because
 * there is no second copy to drift from. Change a value here and both the build
 * and the documentation move together.
 *
 * (There was an earlier `src/ui/tokens/tokens.ts` that looked like this and was
 * imported by nothing — its CSS custom properties were never defined, so every
 * value it exported resolved to an invalid `var(--…)`. Deleted. If a token
 * module isn't wired into the build, it is decoration that lies.)
 */

/* ── colour ───────────────────────────────────────────────────────────────
   The palette is deliberately small and mostly quiet. ONE accent does the
   shouting (lemon); everything else is a surface, a tint, or ink. */
export const colors = {
  ink: "#0E0E10",          // Primary — also the app screen backdrop
  lavender: "#C9C8F0",     // Progress / secondary cards
  lemon: "#F4FF7A",        // Primary card — the app's single action colour
  /** The shared-list tone. Pitched at the lavender's lightness so the two read
   *  as siblings, not a new brand shout. Lemon = the day (yours), lavender =
   *  progress (yours), mint = the one thing that's OURS. */
  mint: "#C4E8D3",
  surface: "#F5F4F8",      // light neutral fill inside light cards
  accent: "#D1D0F5",
  progress: "#C7C6F0",
  /** Text Secondary. Darkened from #686B78, which cleared AA on white but not
   *  on the tinted cards it also sits on — 3.28:1 on lavender, 3.99:1 on mint.
   *  The swatch moved, not the text: dropping these captions to a lighter grey
   *  would have hidden the failure instead of fixing it. Now ≥4.5:1 on every
   *  surface the app puts it on. */
  sub: "#535660",
  card: "#FFFFFF",
  /* muted, never saturated — no bright colours */
  /** The "High ↗" label, overdue dates, and destructive actions. Darkened from
   *  #E5484D, which was only 3.91:1 on a white card — a real AA failure on
   *  14px text that shipped for months because nobody measured it. */
  danger: "#C73F43",
  star: "#C9A21A",
  /** Identity colours. Assigned per member so a person is the same colour on
   *  every surface — avatar, workload bar, calendar chip. */
  member: { maya: "#E8654B", sam: "#3E86C8", leo: "#8B5CF6", ada: "#28A98B", juno: "#C08A4A" },
} as const;

/* ── spacing ──────────────────────────────────────────────────────────────
   Every step is a multiple of 2. */
export const spacing = {
  hair: "2px",      // the base unit
  screen: "4px",    // page gutter
  tile: "8px",      // gap BETWEEN cards/tiles
  "card-pad": "16px",
  inner: "24px",    // inner padding of larger containers
  stack: "16px",    // element spacing INSIDE a card
  section: "32px",  // section spacing
} as const;

/* ── radius ───────────────────────────────────────────────────────────────
   Rounded corners everywhere. Never sharp. */
export const radius = {
  sm: "12px", md: "16px", card: "24px", sheet: "24px", pill: "999px",
} as const;

/* ── controls ─────────────────────────────────────────────────────────────
   Button height 52; minimum touch target 44. */
export const control = { touch: "44px", ctl: "48px", "ctl-lg": "52px" } as const;

/**
 * ── type ────────────────────────────────────────────────────────────────
 * The BIG sizes are Regular (400) — a home is unhurried, and heavy display type
 * reads as urgency. Weight rises as size falls: h2/labels carry 500, because at
 * 16px that's what keeps them legible.
 *
 * Poppins is geometric: modest x-height, tall ascenders, wide round bowls. It
 * needs MORE leading than Inter and falls apart under tight tracking, so the
 * negative letter-spacing is roughly halved.
 *
 * THE 2px GRID. Every value here is even — sizes AND line-heights. Line-heights
 * are in px, not ratios: a ratio silently produces fractional pixels
 * (28 × 1.25 = 35), which is exactly how the halves crept in.
 */
export const fontSize = {
  display: ["36px", { lineHeight: "40px", letterSpacing: "-0.012em", fontWeight: "400" }],
  h1:      ["28px", { lineHeight: "34px", letterSpacing: "-0.01em",  fontWeight: "400" }],
  h2:      ["18px", { lineHeight: "24px", letterSpacing: "-0.002em", fontWeight: "500" }],
  body:    ["16px", { lineHeight: "24px", letterSpacing: "0",        fontWeight: "400" }],
  bodysm:  ["14px", { lineHeight: "20px", letterSpacing: "0",        fontWeight: "400" }],  // controls
  caption: ["14px", { lineHeight: "20px", letterSpacing: "0",        fontWeight: "400" }],  // all meta text
  micro:   ["12px", { lineHeight: "16px", letterSpacing: "0",        fontWeight: "400" }],  // whisper cues ONLY
} as const;

/**
 * ── elevation ───────────────────────────────────────────────────────────
 * Subtle elevation with soft shadows. Never heavy.
 *
 * Names must not collide with colour tokens: an elevation named `card` would
 * make Tailwind read the shadow utility as shadow-COLOUR-white instead of an
 * elevation. Hence e1/e2/e3.
 *
 * (This comment used to spell that utility out literally. Tailwind's content
 * scanner reads raw file text — comments included — so the moment this note
 * moved into a file covered by the `content` globs, the scanner treated the
 * example as a real class and emitted 73 bytes of dead CSS for it. A warning
 * that manufactures the very bug it warns about. Describe it, don't spell it.)
 */
export const boxShadow = {
  e1: "0 2px 4px rgba(14,14,16,.05)",
  e2: "0 2px 8px rgba(14,14,16,.04), 0 8px 24px -12px rgba(14,14,16,.08)",
  e3: "0 4px 16px rgba(14,14,16,.06), 0 16px 32px -16px rgba(14,14,16,.12)",
} as const;

/** Soft pastel gradient: lavender → light gray. The page backdrop. */
export const backgroundImage = {
  room: "linear-gradient(160deg, #C9C8F0 0%, #F5F4F8 100%)",
} as const;

/**
 * The one easing curve, as control points.
 *
 * Framer Motion wants the four numbers and CSS wants the function, so the
 * function is BUILT from the numbers rather than written out beside them —
 * otherwise a tweak in one place leaves a transition somewhere else easing on
 * the old curve, which is the kind of drift nobody sees and nobody reports.
 */
export const easeOut = [0.16, 1, 0.3, 1] as const;
export const timing = { out: `cubic-bezier(${easeOut.join(", ")})` } as const;

/* ── derived counts ───────────────────────────────────────────────────────
   Computed, never typed by hand — the case study prints these, and a number
   typed into prose is a number that goes stale the next time a token lands. */
export const tokenCounts = {
  /** Top-level colour keys (`member` counts once). */
  colorKeys: Object.keys(colors).length,
  /** Actual colour VALUES, unrolling the per-member group. */
  colorValues: Object.keys(colors).length - 1 + Object.keys(colors.member).length,
  members: Object.keys(colors.member).length,
  spacing: Object.keys(spacing).length,
  radius: Object.keys(radius).length,
  type: Object.keys(fontSize).length,
  elevation: Object.keys(boxShadow).length,
} as const;
