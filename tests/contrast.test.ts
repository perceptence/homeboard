import { describe, it, expect } from "vitest";
import { colors } from "@/lib/tokens";
import { contrast, ratio } from "@/lib/contrast";

/**
 * CONTRAST — every text colour against every surface it actually sits on.
 *
 * "Actually sits on" is doing the work. Checking every colour against every
 * other colour would fail on pairs the product never puts together and tell us
 * nothing; these pairs are read off the real components.
 */

const AA_BODY = 4.5;
const AA_LARGE = 3;

/** Text colour → the surfaces it is genuinely rendered on. */
const PAIRS: { text: string; textName: string; on: [string, string][]; large?: boolean }[] = [
  {
    textName: "ink (body text)", text: colors.ink,
    on: [
      ["card", colors.card],
      ["surface", colors.surface],
      ["lemon", colors.lemon],
      ["lavender", colors.lavender],
      ["mint", colors.mint],
      ["accent", colors.accent],
      ["progress", colors.progress],
    ],
  },
  {
    textName: "sub (meta text)", text: colors.sub,
    on: [
      ["card", colors.card],
      ["surface", colors.surface],
      // sub also sits on the tinted cards, e.g. the trend card's captions.
      ["lemon", colors.lemon],
      ["lavender", colors.lavender],
      ["mint", colors.mint],
    ],
  },
  {
    textName: "white (on the ink canvas)", text: colors.card,
    on: [["ink", colors.ink]],
  },
  {
    textName: "danger (the High label)", text: colors.danger,
    on: [["card", colors.card], ["surface", colors.surface], ["lemon", colors.lemon]],
  },
  {
    // The case study's own accent: lemon on ink, used for section labels.
    textName: "lemon (case-study labels)", text: colors.lemon,
    on: [["ink", colors.ink]],
  },
];

describe("text contrast, WCAG AA", () => {
  for (const pair of PAIRS) {
    for (const [surfaceName, surface] of pair.on) {
      it(`${pair.textName} on ${surfaceName} clears ${pair.large ? AA_LARGE : AA_BODY}:1`, () => {
        const r = contrast(pair.text, surface);
        expect(
          r,
          `${pair.textName} on ${surfaceName} is ${ratio(pair.text, surface)}:1`,
        ).toBeGreaterThanOrEqual(pair.large ? AA_LARGE : AA_BODY);
      });
    }
  }
});

describe("the hero's type sits on its veil, not on the artwork", () => {
  /**
   * The hero paints a wall of generated faces, then a near-opaque ink veil, then
   * the headline. Contrast has to be measured at the LIGHTEST frame — the worst
   * case — which here means the lightest backdrop colour a face can contribute,
   * seen through the veil at the darkest band where the type actually sits.
   */
  const VEIL_ALPHA_AT_TYPE = 0.93; // from Hero.tsx's gradient at the type band
  const LIGHTEST_FACE = "#F8D5B8";  // the lightest skin tone in Face.tsx

  const over = (fg: string, bg: string, alpha: number) => {
    const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const [r1, g1, b1] = hex(fg);
    const [r2, g2, b2] = hex(bg);
    const mix = (a: number, b: number) => Math.round(a * alpha + b * (1 - alpha));
    const c = [mix(r1, r2), mix(g1, g2), mix(b1, b2)];
    return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  };

  it("white headline clears AA large over the worst-case backdrop", () => {
    const worst = over(colors.ink, LIGHTEST_FACE, VEIL_ALPHA_AT_TYPE);
    expect(contrast(colors.card, worst)).toBeGreaterThanOrEqual(AA_LARGE);
  });

  it("the lemon kicker clears AA over the same worst case", () => {
    const worst = over(colors.ink, LIGHTEST_FACE, VEIL_ALPHA_AT_TYPE);
    expect(contrast(colors.lemon, worst)).toBeGreaterThanOrEqual(AA_BODY);
  });
});

describe("member identity colours", () => {
  it("are all distinguishable from the ink canvas they sit on", () => {
    for (const [who, hex] of Object.entries(colors.member)) {
      // 3:1 is the non-text threshold — these are dots and bars, not labels.
      expect(contrast(hex, colors.ink), `${who} (${hex}) on ink`).toBeGreaterThanOrEqual(AA_LARGE);
    }
  });
});

/**
 * THE CASE STUDY'S OWN text-white/NN, MEASURED — not read off a blocklist.
 *
 * The PAIRS above check the PRODUCT's named tokens. This checks the article's
 * own habit of reaching for a raw Tailwind opacity instead: `text-white/40`
 * measures 3.79:1 on the ink canvas, a real AA fail, and it shipped three times
 * before a live audit — not this test, which didn't exist yet — caught it. A
 * ratio is computed for whatever opacity actually appears in source, so a
 * future text-white/45 is judged on its own math rather than needing this file
 * edited first to know about it.
 */
describe("the case study's own white/NN text on its dark canvases", () => {
  const sources = import.meta.glob("../src/case-study/*.tsx", { eager: true, query: "?raw", import: "default" });
  const page = import.meta.glob("../app/case-study/*.tsx", { eager: true, query: "?raw", import: "default" });
  /**
   * Duet.tsx is parked — never rendered on the live page (see its own header
   * comment) — so an opacity inside it isn't answering to the claim this test
   * makes. Excluded by name, not by luck.
   */
  const all = Object.fromEntries(
    Object.entries({ ...sources, ...page }).filter(([f]) => !f.endsWith("Duet.tsx")),
  ) as Record<string, string>;

  const composite = (fgHex: string, bgHex: string, alpha: number) => {
    const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const [r1, g1, b1] = rgb(fgHex);
    const [r2, g2, b2] = rgb(bgHex);
    const mix = (a: number, b: number) => Math.round(a * alpha + b * (1 - alpha));
    return `#${[mix(r1, r2), mix(g1, g2), mix(b1, b2)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  };
  /** Panel tone="wash" — the other dark surface this text renders on. */
  const WASH = composite("#FFFFFF", colors.ink, 0.06);

  it("reads enough files to be meaningful", () => {
    expect(Object.keys(all).length).toBeGreaterThan(4);
  });

  it("clears AA body text against the worse of ink and wash, at every opacity used", () => {
    const offenders: string[] = [];
    for (const [file, src] of Object.entries(all)) {
      for (const m of new Set(src.match(/text-white\/\d+/g) ?? [])) {
        const alpha = Number(m.split("/")[1]) / 100;
        const onInk = contrast(composite("#FFFFFF", colors.ink, alpha), colors.ink);
        const onWash = contrast(composite("#FFFFFF", WASH, alpha), WASH);
        const worst = Math.min(onInk, onWash);
        if (worst < AA_BODY) offenders.push(`${file.split("/").pop()} → ${m} (${worst.toFixed(2)}:1)`);
      }
    }
    expect(offenders, `needs text-white/60 or higher:\n${offenders.join("\n")}`).toEqual([]);
  });
});
