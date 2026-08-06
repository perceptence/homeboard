import type { Config } from "tailwindcss";
import containerQueries from "@tailwindcss/container-queries";
import {
  backgroundImage, boxShadow, colors, control, fontSize, radius, spacing, timing,
} from "./src/lib/tokens";

/**
 * Design tokens — transcribed directly from the master prompt.
 * If a value isn't here, it doesn't go in the code.
 *
 * The VALUES now live in `src/lib/tokens.ts`, which this file consumes. That
 * indirection buys one thing: the case-study page renders its swatches and type
 * specimens from that same module, so documentation cannot drift from the build.
 * Everything below is the Tailwind wiring; the palette itself is over there.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      /* Every value below comes from src/lib/tokens.ts — see the note above. */
      colors,
      spacing,
      borderRadius: radius,
      /* Controls — button height 52; minimum touch target 44. */
      height: control,
      width: control,

      fontFamily: {
        sans: ["var(--font-poppins)", "system-ui", "sans-serif"],
        /* `tight` is still the display ROLE, but it's the same family now —
           Poppins ships no condensed cut. */
        tight: ["var(--font-poppins)", "system-ui", "sans-serif"],
      },

      /* The token module is `as const` so the case study can iterate it with
         literal types; Tailwind's Config wants mutable tuples. Identical
         values, looser type — a variance cast, not a data change. */
      fontSize: fontSize as unknown as NonNullable<NonNullable<Config["theme"]>["fontSize"]>,
      boxShadow,
      transitionTimingFunction: timing,
      backgroundImage,
    },
  },
  // The iPad's DeviceFrame renders content at true logical size (834/1194px)
  // inside a `transform: scale()` wrapper for the preview — transforms never
  // affect layout, so a viewport media query (`lg:`) always sees the real
  // browser window, not the device's own width, and can't tell the iPad's
  // orientation apart. Container queries measure the actual (pre-transform)
  // box instead, so `@[1024px]:` on a container scoped to the device's own
  // screen correctly reflects portrait vs landscape regardless of how the
  // preview is scaled to fit the browser window.
  plugins: [containerQueries],
};
export default config;
