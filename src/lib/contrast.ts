/**
 * WCAG contrast, computed — used by the case study's colour specimens to print
 * real ratios, and by the test suite to assert every text colour clears AA
 * against every surface it actually sits on.
 *
 * Both read this one implementation, so a ratio shown on the page is the same
 * number the test enforces.
 */

export type RGB = { r: number; g: number; b: number };

export function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "").trim();
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

/** WCAG 2.1 relative luminance. */
export function luminance({ r, g, b }: RGB): number {
  const f = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** Contrast ratio between two hex colours, 1–21. */
export function contrast(aHex: string, bHex: string): number {
  const a = luminance(hexToRgb(aHex));
  const b = luminance(hexToRgb(bHex));
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

/** Rounded to 2dp, the way a report would state it. */
export const ratio = (a: string, b: string) => Math.round(contrast(a, b) * 100) / 100;

/** AA thresholds: 4.5 for body text, 3.0 for large (>=24px, or >=18.66px bold). */
export const passesAA = (a: string, b: string, large = false) =>
  contrast(a, b) >= (large ? 3 : 4.5);
