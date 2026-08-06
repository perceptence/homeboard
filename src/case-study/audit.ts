/**
 * The accessibility audit, recorded by hand because it cannot be computed from
 * source: it comes from running axe-core against this page in a real browser at
 * two viewports, with every section scrolled through so the embedded
 * applications are actually mounted.
 *
 * SPLIT ON PURPOSE. This page is two different things in one document — a
 * written article, and two live copies of a product running inside it. Reporting
 * one number would let the article hide behind the product or the product hide
 * behind the article. So they're counted separately, and the product's failures
 * are listed rather than rounded off.
 */
export const AUDIT = {
  tool: "axe-core 4.10.2",
  ruleset: "WCAG 2.1 A + AA",
  viewports: ["1440 × 900", "390 × 844"],
  date: "August 2026",

  /**
   * The condition matters, so it's recorded. Sections here mount their
   * applications only while you're near them, so an audit run from the bottom
   * of the page finds nothing to audit. These figures come from a run taken
   * with the two-surface section on screen and all three device frames live —
   * the worst case, deliberately. At 390 wide the same run returns zero,
   * because the board's container queries lay it out differently; quoting that
   * number alone would have been true and misleading.
   */
  measuredWith: "the two-surface section on screen, all three shells mounted",

  /** The case study's own chrome: type, cards, specimens, controls, hero. */
  page: { violations: 0, nodes: 0 },

  /**
   * The embedded product. All one rule — colour contrast — and every one of
   * them is the app's own palette, not this page's.
   */
  product: {
    violations: 1,
    nodes: 18,
    worst: 1.16,
    findings: [
      {
        what: "The iPad's floating nav labels",
        ratio: "1.16:1",
        why: "The nav reads its own backdrop and inverts its text to suit. That sampling uses elementsFromPoint, which misreads once the app is rendered inside a scaled container — so it decides the glass is sitting on something light and paints ink on near-black. It is correct in the app at full size; it is wrong here, in the embed, and that is a real bug either way.",
      },
      {
        what: "Card eyebrows on white (Meals, Bills, Garage…)",
        ratio: "3.93:1",
        why: "text-sub at 75% opacity. The token itself clears AA; the transparency is what drops it under.",
      },
      {
        what: "Meta lines on the ink canvas (Worth a look, Morning/Afternoon/Evening)",
        ratio: "3.79 – 4.26:1",
        why: "White at 40–45% opacity. Same failure mode as the case study's own muted text had, and fixed there — not yet in the app.",
      },
      {
        what: "Captions on the lemon hero card",
        ratio: "3.54:1",
        why: "Ink at 50% on the brightest surface in the palette.",
      },
    ],
  },
} as const;
