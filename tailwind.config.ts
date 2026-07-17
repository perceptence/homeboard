import type { Config } from "tailwindcss";

/**
 * Design tokens — transcribed directly from the master prompt.
 * If a value isn't here, it doesn't go in the code.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        /* --- exact palette --- */
        ink: "#0E0E10",          // Primary — also the app screen backdrop
        lavender: "#C9C8F0",     // Progress / secondary cards
        lemon: "#F4FF7A",        // Primary card
        // The shared-list tone. Pitched at the lavender's lightness so the two
        // read as siblings, not a new brand shout. Lemon = the day (yours),
        // lavender = progress (yours), mint = the one thing that's OURS.
        mint: "#C4E8D3",
        surface: "#F5F4F8",      // light neutral fill inside light cards
        accent: "#D1D0F5",
        progress: "#C7C6F0",
        sub: "#686B78",          // Text Secondary
        card: "#FFFFFF",
        /* muted, never saturated — DO NOT use bright colours */
        danger: "#E5484D",       // the "High ↗" label only
        star: "#C9A21A",
        member: { maya: "#E8654B", sam: "#3E86C8", leo: "#8B5CF6", ada: "#28A98B", juno: "#C08A4A" },
      },

      /* --- layout & spacing --- */
      /* Every step is a multiple of 2. */
      spacing: {
        hair: "2px",      // the base unit
        screen: "4px",    // page gutter
        tile: "8px",      // gap BETWEEN cards/tiles
        "card-pad": "16px",
        inner: "24px",    // inner padding of larger containers
        stack: "16px",    // element spacing INSIDE a card — the base unit
        section: "32px",  // section spacing
      },

      /* Rounded corners everywhere. Never sharp. */
      borderRadius: { sm: "12px", md: "16px", card: "24px", sheet: "24px", pill: "999px" },

      /* Controls — button height 52; minimum touch target 44. */
      height: { touch: "44px", ctl: "48px", "ctl-lg": "52px" },
      width: { touch: "44px", ctl: "48px", "ctl-lg": "52px" },

      fontFamily: {
        sans: ["var(--font-poppins)", "system-ui", "sans-serif"],
        /* `tight` is still the display ROLE, but it's the same family now —
           Poppins ships no condensed cut. */
        tight: ["var(--font-poppins)", "system-ui", "sans-serif"],
      },

      /* The BIG sizes are Regular (400) — a home is unhurried, and heavy display
         type reads as urgency. Weight rises as size falls: h2/labels carry 500,
         because at 16px that's what keeps them legible.
         Poppins is geometric: modest x-height, tall ascenders, wide round bowls.
         It needs MORE leading than Inter and it falls apart under tight tracking,
         so the negative letter-spacing is roughly halved. */
      /* THE 2px GRID. Every value here is even — sizes AND line-heights.
         Line-heights are in px, not ratios: a ratio silently produces fractional
         pixels (28 x 1.25 = 35), which is exactly how the halves crept in. */
      fontSize: {
        display: ["36px", { lineHeight: "40px", letterSpacing: "-0.012em", fontWeight: "400" }],
        h1:      ["28px", { lineHeight: "34px", letterSpacing: "-0.01em",  fontWeight: "400" }],
        h2:      ["18px", { lineHeight: "24px", letterSpacing: "-0.002em", fontWeight: "500" }],
        body:    ["16px", { lineHeight: "24px", letterSpacing: "0",        fontWeight: "400" }],
        bodysm:  ["14px", { lineHeight: "20px", letterSpacing: "0",        fontWeight: "400" }],  // controls
        caption: ["14px", { lineHeight: "20px", letterSpacing: "0",        fontWeight: "400" }],  // all meta text
        micro:   ["12px", { lineHeight: "16px", letterSpacing: "0",        fontWeight: "400" }],  // whisper cues ONLY — never meta text
      },

      /* Subtle elevation with soft shadows. Never heavy. */
      /* NB: names must not collide with colour tokens, or Tailwind reads
         `shadow-card` as shadow-COLOUR:white instead of an elevation. */
      boxShadow: {
        e1: "0 2px 4px rgba(14,14,16,.05)",
        e2: "0 2px 8px rgba(14,14,16,.04), 0 8px 24px -12px rgba(14,14,16,.08)",
        e3: "0 4px 16px rgba(14,14,16,.06), 0 16px 32px -16px rgba(14,14,16,.12)",
      },

      transitionTimingFunction: { out: "cubic-bezier(0.16, 1, 0.3, 1)" },

      backgroundImage: {
        /* Soft pastel gradient: lavender -> light gray */
        room: "linear-gradient(160deg, #C9C8F0 0%, #F5F4F8 100%)",
      },
    },
  },
  plugins: [],
};
export default config;
